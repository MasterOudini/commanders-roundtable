// D416 - THE HAND REVEAL AND CHOOSE, proven at the carrier (Thoughtseize's family).
//
// `Target player reveals their hand. You choose a nonland card from it. That player discards that
// card. You lose 2 life.` - the hand is revealed to every seat (CR 701.15a), the CASTER chooses one
// card the noun admits from the OWNER's revealed hand (the hand prompt with an owner - the chooser
// sees the hand through the peek, the host re-asks the noun of the pick), the owner discards it (or
// it is exiled), and the trailing life loss arrives with the answer so the ask stays last (D195).
// A hand with nothing the noun admits is revealed and nothing else happens.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { project } from './project';
import { deps as depsOf } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const FOREST = 'Forest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p1 casts `spell` at p2, whose hand is emptied first and then holds exactly `hand`. */
function cast(spell: string, mana: readonly ['W' | 'U' | 'B' | 'R' | 'G' | 'C', number][], hand: readonly string[]): { g: Game; theirs: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[spell, BEARS], [BEARS, BEARS, FOREST, FOREST]], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  // The opening seven leave first: the case decides what the revealed hand holds.
  for (const id of [...(g.state.zones.hand.p2 ?? [])]) must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: id, to: { kind: 'library', player: 'p2' } }));
  const theirs = hand.map((n) => put(g, 'p2', n, 'hand'));
  const card = put(g, 'p1', spell, 'hand');
  for (const [sym, n] of mana) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
  return { g, theirs };
}
const zone = (g: Game, id: InstanceId): string => g.state.cards[id]?.zone.kind ?? 'gone';

describe('D416 - the hand reveal: the parser', () => {
  test('the family reads auto with the noun, the negations, the bound, the fate and the life on the spec; the two-zone form stays out', () => {
    const t = parseEffects('Target player reveals their hand. You choose a nonland card from it. That player discards that card. You lose 2 life.', 'X', true);
    expect(t.mode).toBe('auto');
    expect(t.effects).toHaveLength(1);
    expect(t.effects[0]?.kind).toBe('revealHandChoose');
    expect(t.effects[0]?.handChoice?.none).toEqual(['Land']);
    expect(t.effects[0]?.handChoice?.then).toBe('discard');
    expect(t.effects[0]?.handChoice?.loseLife).toBe(2);
    const d = parseEffects('Target opponent reveals their hand. You choose a noncreature, nonland card from it. That player discards that card.', 'X', true);
    expect(d.effects[0]?.handChoice?.none).toEqual(['Creature', 'Land']);
    const a = parseEffects('Target opponent reveals their hand. You choose a card from it with mana value 4 or greater and exile that card.', 'X', true);
    expect(a.effects[0]?.handChoice?.qualifier?.manaValue).toEqual({ op: 'gte', n: 4 });
    expect(a.effects[0]?.handChoice?.then).toBe('exile');
    const c = parseEffects('Target opponent reveals their hand. You choose a creature card from it. Exile that card.', 'X', true);
    expect(c.effects[0]?.handChoice?.filter?.what).toBe('creature card');
    expect(parseEffects("Target opponent reveals their hand. You choose a nonland card from that player's graveyard or hand and exile it.", 'X', true).mode).not.toBe('auto');
    // The ask stays last: a sentence after it leaves the card assisted.
    expect(parseEffects('Target opponent reveals their hand. You choose a card from it. That player discards that card. Draw a card.', 'X', true).mode).not.toBe('auto');
  });
});

describe('D416 - Thoughtseize', () => {
  test('the hand is revealed to every seat, the caster chooses from it on the peek, a land is refused, the pick is discarded and the caster loses 2', () => {
    const { g, theirs } = cast('Thoughtseize', [['B', 1]], [FOREST, BEARS]);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseFromZone');
    if (ask?.kind !== 'chooseFromZone') return;
    expect(ask.player).toBe('p1');
    expect(ask.owner).toBe('p2');
    expect(ask.none).toEqual(['Land']);
    expect(ask.then).toBe('discard');
    expect(ask.loseLife).toBe(2);
    for (const id of theirs) expect(g.state.cards[id]?.revealedTo).toEqual(expect.arrayContaining(['p1', 'p2']));
    // The chooser's view lists the revealed hand as the peek, with the faces.
    const d = depsOf(createRegistry([]));
    const view = project(g.state, d.oracle, d.scripts, 'p1');
    expect([...view.peek].sort()).toEqual([...theirs].sort());
    expect(view.cards[theirs[1] as InstanceId]?.card?.name).toBe(BEARS);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [theirs[0] as InstanceId] }).ok, 'a land is not a nonland card').toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [theirs[1] as InstanceId] }).ok, 'the owner is not the chooser').toBe(false);
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [theirs[1] as InstanceId] }));
    settle(g);
    expect(zone(g, theirs[1] as InstanceId)).toBe('graveyard');
    expect(zone(g, theirs[0] as InstanceId)).toBe('hand');
    expect(g.state.players.p1?.life).toBe(life0 - 2);
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === theirs[1] && m.reason === 'discard'))).toBe(true);
  });
  test('a hand of lands is revealed and nothing is asked; the life is still lost; the hash replays', () => {
    const { g, theirs } = cast('Thoughtseize', [['B', 1]], [FOREST, FOREST]);
    expect(g.state.priority.awaiting).toBeNull();
    for (const id of theirs) expect(zone(g, id)).toBe('hand');
    expect(g.state.players.p1?.life).toBe(38);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('D416 - Castigate and Appetite for Brains', () => {
  test('Castigate exiles the pick', () => {
    const { g, theirs } = cast('Castigate', [['W', 1], ['B', 1]], [BEARS]);
    expect(g.state.priority.awaiting?.kind).toBe('chooseFromZone');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [theirs[0] as InstanceId] }));
    settle(g);
    expect(zone(g, theirs[0] as InstanceId)).toBe('exile');
  });
  test('Appetite for Brains: the mana-value bound refuses a Bears and admits nothing when the hand holds none', () => {
    const { g, theirs } = cast('Appetite for Brains', [['B', 1]], [BEARS, FOREST]);
    expect(g.state.priority.awaiting).toBeNull();
    for (const id of theirs) expect(zone(g, id)).toBe('hand');
  });
});

describe('D416 - Thoughtseize aimed at oneself', () => {
  test('the caster is the owner: the noun and the life loss still hold', () => {
    const g = startedGame({ players: 2, decks: [['Thoughtseize', BEARS, FOREST], [BEARS]], scripts: createRegistry([]) });
    settle(g);
    holdEverywhere(g);
    for (const id of [...(g.state.zones.hand.p1 ?? [])]) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' } }));
    const forest = put(g, 'p1', FOREST, 'hand');
    const bears = put(g, 'p1', BEARS, 'hand');
    const card = put(g, 'p1', 'Thoughtseize', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'chooseFromZone' && ask.owner).toBe('p1');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }).ok, 'a land is refused even in your own hand').toBe(false);
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(g);
    expect(zone(g, bears)).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(life0 - 2);
  });
});
