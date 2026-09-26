// D560 - BLITZ (CR 702.152a): "If you cast this spell for its blitz cost, it gains haste and 'When this creature dies, draw
// a card.' Sacrifice it at the beginning of the next end step." Dash's shape (D449): the keyword alternative cost, the
// entry move's mark (`CardInstance.blitzed`) derive reads for haste, a delayed sacrifice armed as the spell resolves; the
// granted dies-draw is a keyword-table trigger looked back at the move. What is proven here: the reading (the Blitz line
// is the face's alternative cost, the keyword the engine's); Mayhem Patrol cast for its blitz cost has haste, attacks the
// turn it came, is sacrificed at the end step and its death draws a card; one that dies before the end step draws once
// and is not sacrificed again; cast for its mana cost - no haste, no mark, no sacrifice, and its death draws nothing;
// the replay hash on each.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { derive } from './derive';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SCRIPTS = createRegistry([]);
const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const haste = (g: Game, id: InstanceId) => derive(g.state, deps(SCRIPTS).oracle, SCRIPTS, id).keywords.has('haste');
const mana = (g: Game, sym: 'R' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const hand = (g: Game) => (g.state.zones.hand.p1 ?? []).length;
const blitzDraws = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:blitz')).length;
function armed(): { g: Game; card: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Mayhem Patrol', ...LANDS], ['Cyclops of One-Eyed Pass', ...LANDS]], scripts: SCRIPTS });
  holdEverywhere(g);
  const card = put(g, 'p1', 'Mayhem Patrol', 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, card };
}

describe('D560 - blitz', () => {
  test("the reading: the Blitz line is the face's alternative cost, the keyword the engine's", () => {
    const face = ORACLE.byName('Mayhem Patrol')?.faces[0];
    expect(face?.alternativeCost?.keyword).toBe('blitz');
    expect(face?.alternativeCost?.mana?.raw).toBe('{1}{R}');
    expect(face?.keywords).toContain('blitz');
  });

  test('cast for its blitz cost: haste, an attack the turn it came, the end-step sacrifice, and its death draws a card', () => {
    const { g, card } = armed();
    mana(g, 'C', 1);
    mana(g, 'R', 1);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card, alternative: true }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[card]?.blitzed).toBe(true);
    expect(haste(g, card)).toBe(true);
    expect(g.state.delayedTriggers.some((d) => d.source === card && d.when.step === 'end')).toBe(true);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.awaiting === null, 20_000);
    expect(g.state.players.p2?.life, 'the blitzed Patrol attacked the turn it came').toBe(39);
    const nEnd = g.log.length;
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'upkeep', 40_000);
    expect(g.state.cards[card]?.zone.kind, 'sacrificed at the end step').toBe('graveyard');
    expect(g.state.cards[card]?.blitzed, 'the mark left with it').toBeUndefined();
    expect(blitzDraws(g, n0), 'its death drew').toBe(1);
    // The draw is counted off the log: the end step's cleanup may discard back down to seven afterwards.
    expect(g.log.slice(nEnd).filter((e) => e.body.t === 'DrewCards' && e.body.player === 'p1').length, 'a card drawn').toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a blitzed Patrol that dies before the end step draws once, and nothing is left to sacrifice', () => {
    const { g, card } = armed();
    mana(g, 'C', 1);
    mana(g, 'R', 1);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card, alternative: true }));
    settle(g);
    const hand0 = hand(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(blitzDraws(g, n0), 'its death drew').toBe(1);
    expect(hand(g)).toBe(hand0 + 1);
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'upkeep', 40_000);
    expect(blitzDraws(g, n0), 'no second draw').toBe(1);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('cast for its mana cost: no haste, no mark, no sacrifice, and its death draws nothing', () => {
    const { g, card } = armed();
    mana(g, 'C', 1);
    mana(g, 'R', 1);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[card]?.blitzed).toBeUndefined();
    expect(haste(g, card)).toBe(false);
    expect(g.state.delayedTriggers.some((d) => d.source === card)).toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'upkeep', 40_000);
    expect(g.state.cards[card]?.zone.kind, 'it stays').toBe('battlefield');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(blitzDraws(g, n0), 'no blitz, no draw').toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
