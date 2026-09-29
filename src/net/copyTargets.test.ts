import { describe, expect, test, vi } from 'vitest';
import { DEFAULT_STOPS, type TargetChoice } from '../engine/types/state';
import type { Intent } from '../engine/types/intents';
import { parseTargetClauses } from '../data/targetParse';
import type { PlayerView } from '../view/types';
import { fixtureCard, makeTable, settle, type TestTable } from './testing/table';
import { simplestIntent } from './testing/script';
import { printingsIn } from './wire';
import type { ClientSession } from './client';

// A COPY of a spell on the stack (D487, CR 707.10) has no card, so the client read no card types, colours or mana
// value for it while the host reads them off `StackObject.copyOf`: a typed clause lit the copy on the host's side of
// D81 and refused it in the veil - the veil hid a legal choice. The view now carries the copy's copiable identity and
// the client reads it exactly as the host does; the printing it names is shipped like a card's. A real host and two
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
/** The stack item that is a spell with no card - a copy. */
const copyOnStack = (c: ClientSession) => c.currentView().stack.find((i) => i.kind === 'spell' && i.instanceId === null);
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

describe('the client veil reads a spell copy', () => {
  test('Reverberate' + "'" + 's copy of a Bolt lights for Twincast, a red spell and a mana value - and the host takes Twincast at it', async () => {
    const { table, p1, p2 } = await seated(
      deck('Kess, Dissident Mage', [['Reverberate', 12], ['Twincast', 12], ['Island', 8], ['Mountain', 8]]),
      deck('Krenko, Mob Boss', [['Lightning Bolt', 20], ['Mountain', 20]]),
    );
    const rev = inHand(p1, 'p1', 'Reverberate')[0];
    const twincast = inHand(p1, 'p1', 'Twincast')[0];
    const boltCard = inHand(p2, 'p2', 'Lightning Bolt')[0];
    if (!rev || !twincast || !boltCard) throw new Error('the opening hands hold no Reverberate, Twincast and Lightning Bolt');
    await must(p1, { t: 'PassPriority', player: 'p1' });
    await must(p2, { t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'R', amount: 1 });
    await must(p2, { t: 'CastSpell', player: 'p2', card: boltCard, targets: [{ kind: 'player', id: 'p1' }] });
    await must(p2, { t: 'PassPriority', player: 'p2' });
    const bolt = p1.currentView().stack[0]?.stackItemId ?? '';
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: bolt }] });
    walk(table, () => p1.snapshot().awaiting?.kind === 'chooseTargets');
    await must(p1, { t: 'ChooseTargets', player: 'p1', targets: [] });
    const copy = copyOnStack(p1)?.stackItemId;
    if (!copy) throw new Error('no copy on the stack');
    expect(p1.snapshot().priority, 'p1 holds priority over the Bolt and its copy').toBe('p1');
    expect(stackIds(p1.legalTargetsFor(p1.targetSpecsFor(twincast), twincast)), 'Twincast: an instant or sorcery spell - both').toEqual([bolt, copy].sort());
    expect(stackIds(p1.legalTargetsFor(parseTargetClauses('Counter target red spell.'), twincast)), 'a red spell - both').toEqual([bolt, copy].sort());
    expect(stackIds(p1.legalTargetsFor(parseTargetClauses('Counter target spell with mana value 1 or less.'), twincast)), 'mana value 1 - both').toEqual([bolt, copy].sort());
    expect(stackIds(p1.legalTargetsFor(parseTargetClauses('Counter target creature spell.'), twincast)), 'a creature spell - neither').toEqual([]);
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 });
    expect(await refused(p1, { t: 'CastSpell', player: 'p1', card: twincast, targets: [{ kind: 'stack', id: copy }] }), 'the host takes Twincast at the copy').toBe(false);
  });

  test('Fork' + "'" + 's copy of a blue Opt lights as red, never as blue (the copying clause' + "'" + 's colour)', async () => {
    const { table, p1 } = await seated(
      deck('Kess, Dissident Mage', [['Fork', 13], ['Opt', 13], ['Island', 7], ['Mountain', 7]]),
      deck('Krenko, Mob Boss', [['Mountain', 40]]),
    );
    const opt = inHand(p1, 'p1', 'Opt')[0];
    const fork = inHand(p1, 'p1', 'Fork')[0];
    if (!opt || !fork) throw new Error('the opening hand holds no Opt and Fork');
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: opt });
    const optStack = p1.currentView().stack[0]?.stackItemId ?? '';
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: fork, targets: [{ kind: 'stack', id: optStack }] });
    walk(table, () => copyOnStack(p1) !== undefined);
    const copy = copyOnStack(p1)?.stackItemId;
    if (!copy) throw new Error('no copy on the stack');
    expect(stackIds(p1.legalTargetsFor(parseTargetClauses('Counter target red spell.'), fork)), 'the red copy alone').toEqual([copy]);
    expect(stackIds(p1.legalTargetsFor(parseTargetClauses('Counter target blue spell.'), fork)), 'the blue Opt alone').toEqual([optStack]);
    expect(stackIds(p1.legalTargetsFor(parseTargetClauses('Counter target instant spell.'), fork)), 'an instant - both').toEqual([optStack, copy].sort());
  });

  test('a copy' + "'" + 's printing is shipped with the view, whether or not a visible card carries it', () => {
    const view = {
      cards: {},
      stack: [{ stackItemId: 's2', kind: 'spell', instanceId: null, copyOf: { printingId: 'printing-of-the-copied-spell', faceIndex: 0, colors: null }, label: 'Lightning Bolt (copy)', controller: 'p1', identity: ['R'], targets: [] }],
    } as unknown as PlayerView;
    expect([...printingsIn(view)]).toEqual(['printing-of-the-copied-spell']);
  });
});
