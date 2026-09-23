// D528 - SAGAS (CR 714). A Saga enters with a lore counter (714.2a) and gets one as its controller's precombat main
// phase begins (714.2b); a chapter ability triggers as the count passes its number (714.2c - the chapter defs are the
// card scripts', a trigger on the counter change reading the count before and after, so a lore counter from ANY source
// tells a chapter); once the count has reached the final chapter and no chapter ability of the Saga's is pending or on
// the stack, the state-based actions sacrifice it (714.4). What is proven here: the final chapter read off the printed
// lines; Summon: Anima's shared chapter (I, II, III - a draw and a life, at the entry and at each own precombat main),
// its fourth (the opponent's sacrifice and three life) and the sacrifice AFTER that ability resolved, not while it
// waits; Origin of the Hulk's chapters off lore counters put by hand; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { sagaFinalChapter } from './sba';
import { derive } from './derive';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import { ORIGIN_OF_THE_HULK, SUMMON_ANIMA } from '../data/fixtures/engineCards';

type TriggerDef = NonNullable<CardScript['triggers']>[number];

/** A chapter def as the row maker generates one: the lore count passing a chapter number (before < n <= after). */
function chapter(card: { readonly name: string }, line: number, chapters: readonly number[], text: string, payload: string): TriggerDef {
  const VOCAB = vocabularyEffects(payload, card.name);
  const VOCAB_T = vocabularyTargets(payload);
  return {
    abilityId: `chapter-${line}`,
    text,
    event: 'CountersChanged',
    activeZones: ['battlefield'],
    optional: false,
    targets: VOCAB_T,
    matches: (ctx, self, ev) => {
      if (ev.t !== 'CountersChanged') return false;
      const after = ctx.state.cards[self]?.counters['lore'] ?? 0;
      return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && chapters.some((n) => n > after - c.delta && n <= after));
    },
    label: () => `${card.name} - ${text}`,
    resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, VOCAB, VOCAB_T),
  };
}

const HULK: CardScript = {
  oracleId: ORIGIN_OF_THE_HULK.oracleId,
  name: ORIGIN_OF_THE_HULK.name,
  triggers: [
    chapter(ORIGIN_OF_THE_HULK, 0, [1], 'I — Create a 1/1 green and white Citizen creature token.', 'Create a 1/1 green and white Citizen creature token.'),
    chapter(ORIGIN_OF_THE_HULK, 1, [2], 'II — Put two +1/+1 counters on target creature you control.', 'Put two +1/+1 counters on target creature you control.'),
    chapter(ORIGIN_OF_THE_HULK, 2, [3], 'III — Target creature you control gets +3/+3 and gains trample until end of turn.', 'Target creature you control gets +3/+3 and gains trample until end of turn.'),
  ],
};
const ANIMA: CardScript = {
  oracleId: SUMMON_ANIMA.oracleId,
  name: SUMMON_ANIMA.name,
  triggers: [
    chapter(SUMMON_ANIMA, 0, [1, 2, 3], 'I, II, III — Pain — You draw a card and you lose 1 life.', 'You draw a card and you lose 1 life.'),
    chapter(SUMMON_ANIMA, 1, [4], 'IV — Oblivion — Each opponent sacrifices a creature of their choice and loses 3 life.', 'Each opponent sacrifices a creature of their choice and loses 3 life.'),
  ],
};

const REG = createRegistry([HULK, ANIMA]);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const lore = (g: Game, id: InstanceId) => g.state.cards[id]?.counters['lore'] ?? 0;
const hand = (g: Game, who: string) => (g.state.zones.hand[who] ?? []).length;
const life = (g: Game, who: string) => g.state.players[who]?.life ?? 0;
const sacrificed = (g: Game) => g.log.filter((e) => e.body.t === 'SagaSacrificed').length;

function game(): { g: Game; cyclops: InstanceId } {
  const forests = (n: number) => Array.from({ length: n }, () => 'Forest');
  const g = startedGame({
    players: 2,
    decks: [['Summon: Anima', 'Origin of the Hulk', 'Grizzly Bears', ...forests(18)], ['Cyclops of One-Eyed Pass', ...forests(10)]],
    scripts: REG,
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  return { g, cyclops };
}

describe('D528 - sagas', () => {
  test('the final chapter is read off the printed chapter lines', () => {
    const { g } = game();
    const hulk = put(g, 'p1', 'Origin of the Hulk');
    const anima = put(g, 'p1', 'Summon: Anima');
    settle(g);
    const hulkCard = g.state.cards[hulk];
    const animaCard = g.state.cards[anima];
    if (!hulkCard || !animaCard) throw new Error('the Sagas are not in the game');
    expect(sagaFinalChapter(deps().oracle, hulkCard)).toBe(3);
    expect(sagaFinalChapter(deps().oracle, animaCard)).toBe(4);
  });

  test('Summon: Anima - a lore counter at the entry and each own precombat main, the shared chapter three times, the fourth, then the sacrifice', () => {
    const { g, cyclops } = game();
    // From the graveyard, so the hand baseline does not count the card leaving it (the generated suites' way).
    const anima = put(g, 'p1', 'Summon: Anima', 'graveyard');
    settle(g);
    const hand0 = hand(g, 'p1');
    const life0 = life(g, 'p1');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: anima, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    // CR 714.2a: it entered with a lore counter, and chapter I was told at once.
    expect(lore(g, anima)).toBe(1);
    expect(hand(g, 'p1')).toBe(hand0 + 1);
    expect(life(g, 'p1')).toBe(life0 - 1);
    // CR 714.2b: p1's next precombat main (turn 3) adds the second counter; chapter II is the same def, told again.
    main(g, 3);
    const hand3 = hand(g, 'p1');
    const life3 = life(g, 'p1');
    settle(g);
    expect(lore(g, anima)).toBe(2);
    expect(hand(g, 'p1')).toBe(hand3 + 1);
    expect(life(g, 'p1')).toBe(life3 - 1);
    expect(g.state.cards[anima]?.zone.kind).toBe('battlefield');
    main(g, 5);
    const life5 = life(g, 'p1');
    settle(g);
    expect(lore(g, anima)).toBe(3);
    expect(life(g, 'p1')).toBe(life5 - 1);
    expect(g.state.cards[anima]?.zone.kind, 'the final chapter is IV: not sacrificed at III').toBe('battlefield');
    // The fourth counter: chapter IV triggers, and CR 714.4 waits for it to leave the stack.
    main(g, 7);
    expect(lore(g, anima)).toBe(4);
    expect(g.state.stack.length + g.state.pendingTriggers.length, 'chapter IV is waiting').toBeGreaterThan(0);
    expect(g.state.cards[anima]?.zone.kind, 'not sacrificed while its chapter ability waits (CR 714.4)').toBe('battlefield');
    expect(sacrificed(g)).toBe(0);
    const p2life = life(g, 'p2');
    settle(g);
    // Chapter IV resolved: the opponent's only creature is gone and three life with it; then the Saga was sacrificed.
    expect(g.state.cards[cyclops]?.zone.kind).toBe('graveyard');
    expect(life(g, 'p2')).toBe(p2life - 3);
    expect(g.state.cards[anima]?.zone.kind).toBe('graveyard');
    expect(sacrificed(g)).toBe(1);
    expect(g.log.some((e) => e.body.t === 'Narrated' && /final chapter told/.test(e.body.text)), 'the sacrifice says why').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Origin of the Hulk - a lore counter from any source tells the chapter the count reaches; the Saga goes after III', () => {
    const { g } = game();
    const board0 = g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === 'p1').length;
    const hulk = put(g, 'p1', 'Origin of the Hulk');
    settle(g);
    // Chapter I: the Citizen.
    const mine = () => g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === 'p1');
    expect(mine().length).toBe(board0 + 2);
    const citizen = mine().find((id) => id !== hulk);
    if (!citizen) throw new Error('no Citizen');
    // A lore counter put by hand (CR 714.2c reads the count, not the turn): chapter II, aimed at the Citizen.
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: hulk, kind: 'lore', delta: 1 }));
    settle(g);
    expect(lore(g, hulk)).toBe(2);
    expect(g.state.cards[citizen]?.counters['+1/+1'] ?? 0).toBe(2);
    expect(g.state.cards[hulk]?.zone.kind).toBe('battlefield');
    // The third: chapter III pumps the Citizen, then the state-based actions sacrifice the Saga.
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: hulk, kind: 'lore', delta: 1 }));
    settle(g);
    expect(g.state.cards[hulk]?.zone.kind).toBe('graveyard');
    expect(sacrificed(g)).toBe(1);
    const derived = derive(g.state, deps().oracle, REG, citizen);
    expect(derived.power).toBe(6);
    expect(derived.keywords.has('trample')).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
