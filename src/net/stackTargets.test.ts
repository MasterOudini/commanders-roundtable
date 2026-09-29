import { describe, expect, test, vi } from 'vitest';
import { DEFAULT_STOPS, type TargetChoice } from '../engine/types/state';
import type { Intent } from '../engine/types/intents';
import { parseTargetClauses } from '../data/targetParse';
import { fixtureCard, makeTable, settle, type TestTable } from './testing/table';
import { simplestIntent } from './testing/script';
import type { ClientSession } from './client';

// The client's half of the stack rules: `ClientSession.legalTargetsFor` - the aim veil's, the bot's and the net
// driver's opinion, computed off the PlayerView (D81's second adapter) - agrees with the host. Counterspell lights a
// spell on the stack and never an ability (the view says which a stack item is); a Stifle clause lights the ability
// alone; and a copy asked for new targets never lights itself (CR 115.5). The host refuses each. A real host and two
// loopback clients (the net testing table - the production path).

// A host over the shipped registry walks `legalActions` on every intent (net.test.ts' measured budget).
vi.setConfig({ testTimeout: 120_000 });

const entry = (name: string) => {
  const c = fixtureCard(name);
  return { oracleId: c.oracleId, printingId: c.scryfallId };
};
const deck = (commander: string, cards: readonly (readonly [string, number])[]) => ({
  name: `${commander} test deck`,
  commanders: [entry(commander)],
  mainDeck: cards.flatMap(([name, n]) => Array.from({ length: n }, () => entry(name))),
});

/** Every prompt answered and every priority passed until `done` holds - nobody plays or casts on their own. */
function walk(table: TestTable, done: () => boolean): void {
  for (let i = 0; i < 500 && !done(); i++) {
    let moved = false;
    for (const { session: c } of table.clients) {
      const s = c.snapshot();
      const intent = s.awaiting !== null ? simplestIntent(c, s) : s.priority === s.you ? ({ t: 'PassPriority', player: s.you } as const) : null;
      if (intent === null) continue;
      c.submit(intent);
      moved = true;
      break;
    }
    if (!moved) return;
  }
}

/** Two seats at p1's first main phase, every stop held (the engine suite's `holdEverywhere`). */
async function seated(p1Deck: ReturnType<typeof deck>, p2Deck: ReturnType<typeof deck>): Promise<{ table: TestTable; p1: ClientSession; p2: ClientSession }> {
  const table = makeTable();
  const ada = table.join('Ada');
  const bo = table.join('Bo');
  ada.session.submitDeck(p1Deck);
  bo.session.submitDeck(p2Deck);
  await settle();
  ada.session.setReady(true);
  bo.session.setReady(true);
  expect(table.host.start().ok).toBe(true);
  await settle();
  const p1 = ada.session;
  const p2 = bo.session;
  walk(table, () => {
    const s = p1.snapshot();
    return s.turn.active === 'p1' && s.turn.step === 'precombatMain' && s.priority === 'p1' && s.awaiting === null;
  });
  p1.submit({ t: 'SetStops', player: 'p1', stops: { ...DEFAULT_STOPS, mode: 'fullControl' } });
  p2.submit({ t: 'SetStops', player: 'p2', stops: { ...DEFAULT_STOPS, mode: 'fullControl' } });
  await settle();
  return { table, p1, p2 };
}

const inHand = (c: ClientSession, who: 'p1' | 'p2', name: string) =>
  (c.currentView().zones[`hand:${who}`] ?? []).filter((id) => c.currentView().cards[id]?.card?.name === name);
const stackIds = (choices: readonly TargetChoice[]) => choices.flatMap((c) => (c.kind === 'stack' ? [c.id] : [])).sort();
/** Sends the intent; true when the host refused it (a refusal bumps the client's `rejectSeq`). */
async function refused(c: ClientSession, intent: Intent): Promise<boolean> {
  const seq = c.snapshot().rejectSeq;
  c.submit(intent);
  await settle();
  return c.snapshot().rejectSeq !== seq;
}
async function must(c: ClientSession, intent: Intent): Promise<void> {
  if (await refused(c, intent)) throw new Error(`the host refused ${intent.t}: ${c.snapshot().message ?? ''}`);
}

describe('the client veil over the stack', () => {
  test('Counterspell lights the spell and never the conspire trigger; a Stifle clause lights the trigger alone', async () => {
    const { p1, p2 } = await seated(
      deck('Krenko, Mob Boss', [['Burn Trail', 13], ['Hill Giant', 14], ['Mountain', 13]]),
      deck('Talrand, Sky Summoner', [['Counterspell', 20], ['Island', 20]]),
    );
    const trail = inHand(p1, 'p1', 'Burn Trail')[0];
    const giants = inHand(p1, 'p1', 'Hill Giant').slice(0, 2);
    const counter = inHand(p2, 'p2', 'Counterspell')[0];
    if (!trail || giants.length < 2 || !counter) throw new Error('the opening hands hold no Burn Trail, two Hill Giants and a Counterspell');
    for (const g of giants) await must(p1, { t: 'ManualMoveCard', player: 'p1', card: g, to: { kind: 'battlefield', player: 'p1' } });
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 });
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: trail, targets: [{ kind: 'player', id: 'p2' }], conspired: true, tap: giants });
    const stack = p2.currentView().stack;
    expect(stack.map((i) => i.kind), 'Burn Trail and its conspire trigger, as the client sees them').toEqual(['spell', 'triggered']);
    const [spell, trigger] = stack.map((i) => i.stackItemId) as [string, string];
    expect(stackIds(p2.legalTargetsFor(p2.targetSpecsFor(counter), counter)), 'Counterspell lights the spell alone').toEqual([spell]);
    expect(stackIds(p2.legalTargetsFor(parseTargetClauses('Counter target activated or triggered ability.'), counter)), 'a Stifle clause lights the trigger alone').toEqual([trigger]);
    expect(stackIds(p2.legalTargetsFor(parseTargetClauses('Counter target spell or ability.'), counter)), 'either').toEqual([spell, trigger].sort());
    await must(p1, { t: 'PassPriority', player: 'p1' });
    expect(p2.snapshot().priority).toBe('p2');
    await must(p2, { t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'U', amount: 2 });
    expect(await refused(p2, { t: 'CastSpell', player: 'p2', card: counter, targets: [{ kind: 'stack', id: trigger }] }), 'the host refuses Counterspell at the trigger').toBe(true);
    expect(await refused(p2, { t: 'CastSpell', player: 'p2', card: counter, targets: [{ kind: 'stack', id: spell }] }), 'and takes it at the spell').toBe(false);
  });

  test('a copy asked for new targets never lights itself (CR 115.5), and the host refuses it', async () => {
    const { table, p1, p2 } = await seated(
      deck('Kess, Dissident Mage', [['Counterspell', 10], ['Reverberate', 10], ['Island', 10], ['Mountain', 10]]),
      deck('Krenko, Mob Boss', [['Lightning Bolt', 20], ['Mountain', 20]]),
    );
    const counter = inHand(p1, 'p1', 'Counterspell')[0];
    const rev = inHand(p1, 'p1', 'Reverberate')[0];
    const boltCard = inHand(p2, 'p2', 'Lightning Bolt')[0];
    if (!counter || !rev || !boltCard) throw new Error('the opening hands hold no Counterspell, Reverberate and Lightning Bolt');
    await must(p1, { t: 'PassPriority', player: 'p1' });
    await must(p2, { t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'R', amount: 1 });
    await must(p2, { t: 'CastSpell', player: 'p2', card: boltCard, targets: [{ kind: 'player', id: 'p1' }] });
    await must(p2, { t: 'PassPriority', player: 'p2' });
    const bolt = p1.currentView().stack[0]?.stackItemId ?? '';
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: counter, targets: [{ kind: 'stack', id: bolt }] });
    const original = p1.currentView().stack[1]?.stackItemId ?? '';
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: original }] });
    walk(table, () => p1.snapshot().awaiting?.kind === 'chooseTargets');
    const ask = p1.snapshot().awaiting;
    if (ask?.kind !== 'chooseTargets' || ask.forKind !== 'copy') throw new Error('no copy prompt');
    expect(p1.currentView().stack.some((i) => i.stackItemId === ask.stackId), 'the copy is on the stack as it is aimed').toBe(true);
    const lit = stackIds(p1.legalTargetsFor(ask.specs, ask.source));
    expect(lit, 'never the copy itself').not.toContain(ask.stackId);
    expect(lit, 'the Bolt and the original Counterspell still').toEqual(expect.arrayContaining([bolt, original]));
    expect(await refused(p1, { t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: ask.stackId }] }), 'the host refuses the copy as its own target').toBe(true);
    expect(await refused(p1, { t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: original }] }), 'and takes the original').toBe(false);
  });
});
