// D491's GRANTED FREE CAST, from the bot's side: its answer pays the optional costs the cast may still pay (CR 118.9d),
// priced by the client's own preview of the granted cast (no `CastSpell` offer exists while the prompt is up) and chosen
// by the normal cast's rules one prompt over (policy.ts): a conspire when two creatures may pay it, a casualty with a
// SPARE creature (D585's `spareFor` - a token, never the Hill Giant beside it), a kick when the kicked cast has a plan;
// nothing payable, nothing announced; a refused answer is made again plain (`attempt`). Over the real host and clients
// (the net testing table), so the host takes exactly what the bot sends. Sram's Expertise is the grant each time: three
// Servos, then `You may cast a spell with mana value 3 or less from your hand without paying its mana cost.`
import { describe, expect, test, vi } from 'vitest';
import { answerAwaiting } from './awaiting';
import type { BotPort } from './types';
import { fixtureCard, makeTable, settle, type TestTable } from '../net/testing/table';
import { simplestIntent } from '../net/testing/script';
import type { GameEvent } from '../engine/types/events';
import type { Intent } from '../engine/types/intents';

// A host over the shipped registry walks `legalActions` on every intent (net.test.ts' measured budget).
vi.setConfig({ testTimeout: 120_000 });

const SRAM = "Sram's Expertise";
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

/**
 * Ada's main phase with Sram's Expertise and `candidate` in hand, `board` moved onto her battlefield and `extra` floating
 * beside the Expertise's {2}{W}{W}; the Expertise cast and resolved to its grant - the chooser up for the bot to answer.
 */
async function granted(candidate: string, board: readonly (readonly [string, number])[], extra: readonly (readonly ['W' | 'U' | 'B' | 'R' | 'G' | 'C', number])[]) {
  const events: GameEvent[] = [];
  const table = makeTable({ onEvents: (e) => events.push(...e) });
  const ada = table.join('Ada');
  const bo = table.join('Bo');
  // Plains in the deck: a land drop is what stops the seat in its main phase (auto-pass never skips one).
  const bodies = board.map(([name]) => [name, 8] as const);
  ada.session.submitDeck(deck('Talrand, Sky Summoner', [[SRAM, 12], [candidate, 10], ...bodies, ['Plains', 18 - 8 * bodies.length]]));
  bo.session.submitDeck(deck('Krenko, Mob Boss', [['Mountain', 40]]));
  await settle();
  ada.session.setReady(true);
  bo.session.setReady(true);
  expect(table.host.start().ok).toBe(true);
  await settle();
  const p1 = ada.session;
  walk(table, () => {
    const s = p1.snapshot();
    return s.turn.active === 'p1' && s.turn.step === 'precombatMain' && s.priority === 'p1' && s.awaiting === null;
  });
  const view = () => p1.currentView();
  const named = (zone: 'hand:p1' | 'bf:p1', name: string) => (view().zones[zone] ?? []).filter((id) => view().cards[id]?.card?.name === name);
  // Drawn until the hand holds what the scenario needs (the opening seven is the seed's).
  const need = [[SRAM, 1], [candidate, 1], ...board] as const;
  for (let i = 0; i < 30 && need.some(([name, n]) => named('hand:p1', name).length < n); i++) p1.submit({ t: 'ManualDraw', player: 'p1', target: 'p1', count: 1 });
  for (const [name, n] of board) {
    for (const id of named('hand:p1', name).slice(0, n)) p1.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } });
  }
  const sram = named('hand:p1', SRAM)[0];
  const copies = named('hand:p1', candidate);
  if (!sram || copies.length === 0) throw new Error(`the hand holds no ${SRAM} or ${candidate}`);
  for (const [symbol, amount] of [['W', 2], ['C', 2], ...extra] as const) p1.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount });
  p1.submit({ t: 'CastSpell', player: 'p1', card: sram });
  walk(table, () => {
    const a = p1.snapshot().awaiting;
    return a?.kind === 'chooseFromZone' && a.castFree === true;
  });
  const awaiting = p1.snapshot().awaiting;
  if (awaiting?.kind !== 'chooseFromZone' || awaiting.castFree !== true) throw new Error(`no grant up: ${awaiting?.kind ?? 'none'}`);
  const answer = (attempt = 0): Intent => {
    const d = answerAwaiting(p1 as unknown as BotPort, awaiting, 'p1', attempt);
    if (d.t !== 'act') throw new Error(`the bot did not act: ${d.t}`);
    return d.intent;
  };
  // The copy the bot names (its order: the most expensive, then the lowest id) - one of the candidate's copies in hand.
  const first = answer(1);
  const pick = first.t === 'AnswerChooseFromZone' ? first.cards[0] : undefined;
  if (pick === undefined || !copies.includes(pick)) throw new Error(`the bot names no ${candidate}: ${JSON.stringify(first)}`);
  /** Sends the bot's answer and walks the stack empty; whether the host took it. */
  const play = (intent: Intent): boolean => {
    const seq0 = p1.snapshot().rejectSeq;
    p1.submit(intent);
    const took = p1.snapshot().rejectSeq === seq0;
    walk(table, () => view().stack.length === 0 && p1.snapshot().awaiting === null && p1.snapshot().priority === 'p1');
    return took;
  };
  return { events, view, named, pick, answer, play };
}

describe("D491 - the bot's granted free cast pays its optional costs", () => {
  test('casualty with a spare Servo token, never the Hill Giant: the host takes it, the Servo sacrificed, the spell copied', async () => {
    const { events, named, pick: chat, answer, play } = await granted('A Little Chat', [['Hill Giant', 1]], []);
    const servos = named('bf:p1', 'Servo');
    const [giant] = named('bf:p1', 'Hill Giant');
    expect(servos, "the Expertise's three tokens").toHaveLength(3);
    expect(answer(1), 'a refused answer is made again plain').toEqual({ t: 'AnswerChooseFromZone', player: 'p1', cards: [chat] });
    const intent = answer();
    expect(intent).toMatchObject({ t: 'AnswerChooseFromZone', player: 'p1', cards: [chat], cast: { casualty: true } });
    const sacrificed = intent.t === 'AnswerChooseFromZone' ? (intent.cast?.sacrifice ?? []) : [];
    expect(sacrificed.length === 1 && servos.includes(sacrificed[0] as string), 'one Servo, the token').toBe(true);
    const copies0 = events.filter((e) => e.body.t === 'SpellCopied').length;
    expect(play(intent), 'the host takes the answer').toBe(true);
    expect(named('bf:p1', 'Servo'), 'the casualty').toHaveLength(2);
    expect(named('bf:p1', 'Hill Giant'), 'the Giant spared').toEqual([giant]);
    expect(events.filter((e) => e.body.t === 'SpellCopied').length - copies0, 'the casualty copy').toBe(1);
  });

  test('a kick when the kicked cast has a plan: Kavu Titan enters with three counters', async () => {
    const { view, named, pick: titan, answer, play } = await granted('Kavu Titan', [], [['G', 1], ['C', 2]]);
    const intent = answer();
    expect(intent).toEqual({ t: 'AnswerChooseFromZone', player: 'p1', cards: [titan], cast: { kicked: 1 } });
    expect(play(intent), 'the host takes the answer').toBe(true);
    expect(named('bf:p1', 'Kavu Titan')).toEqual([titan]);
    expect(view().cards[titan]?.counters['+1/+1'], 'the kicked entry').toBe(3);
  });

  test('a kick the mana cannot pay is never announced: the plain free cast', async () => {
    const { view, pick: titan, answer, play } = await granted('Kavu Titan', [], []);
    const intent = answer();
    expect(intent, 'no kick, nothing announced').toEqual({ t: 'AnswerChooseFromZone', player: 'p1', cards: [titan] });
    expect(play(intent)).toBe(true);
    expect(view().cards[titan]?.counters['+1/+1'] ?? 0).toBe(0);
  });

  test('a conspire when two creatures share a colour with the spell: both tap, the spell copied', async () => {
    const { events, view, named, pick: discovery, answer, play } = await granted('Ghastly Discovery', [['Merfolk of the Pearl Trident', 2]], []);
    const merfolk = named('bf:p1', 'Merfolk of the Pearl Trident');
    expect(merfolk).toHaveLength(2);
    const intent = answer();
    expect(intent).toMatchObject({ t: 'AnswerChooseFromZone', player: 'p1', cards: [discovery], cast: { conspired: true } });
    expect(intent.t === 'AnswerChooseFromZone' ? [...(intent.cast?.tap ?? [])].sort() : [], 'the two blue creatures, never a colourless Servo').toEqual([...merfolk].sort());
    const copies0 = events.filter((e) => e.body.t === 'SpellCopied').length;
    expect(play(intent), 'the host takes the answer').toBe(true);
    expect(merfolk.map((id) => view().cards[id]?.tapped), 'the conspire').toEqual([true, true]);
    expect(events.filter((e) => e.body.t === 'SpellCopied').length - copies0, 'the conspire copy').toBe(1);
  });
});
