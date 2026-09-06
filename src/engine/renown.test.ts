// D340 - RENOWN (CR 702.112): "When this creature deals combat damage to a
// player, if it isn't renowned, put N +1/+1 counters on it and it becomes
// renowned." The flag lives on the instance, set by `BecameRenowned` and
// cleared with the other battlefield fields when the permanent leaves: the
// first hit counts, the second does not, and a bounced creature starts over.
// Proven on Topan Freeblade (Renown 1), a generated row.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { TOPAN_FREEBLADE_SCRIPT } from './scripts/cards/topanFreeblade';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
const plusOnes = (g: Game, id: InstanceId): number => g.state.cards[id]?.counters['+1/+1'] ?? 0;

/** Topan Freeblade on p1's board, at p1's declare-attackers prompt of the given turn. */
function atAttack(g: Game, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p1', 60_000);
}
function hit(g: Game, self: InstanceId, turn: number): void {
  atAttack(g, turn);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'postcombatMain', 20_000);
  settle(g);
}
function board(): { g: Game; self: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Topan Freeblade'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([TOPAN_FREEBLADE_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const self = put(g, 'p1', 'Topan Freeblade');
  settle(g);
  return { g, self };
}

describe('D340 - renown', () => {
  test('the first hit puts the counter on and marks it renowned; the second hit does nothing more', () => {
    const { g, self } = board();
    expect(g.state.cards[self]?.renowned).toBe(false);
    hit(g, self, 3);
    expect(plusOnes(g, self)).toBe(1);
    expect(g.state.cards[self]?.renowned).toBe(true);
    hit(g, self, 5);
    expect(plusOnes(g, self)).toBe(1);
    expect(g.state.cards[self]?.renowned).toBe(true);
  });

  test('leaving the battlefield clears it, and the creature can become renowned again', () => {
    const { g, self } = board();
    hit(g, self, 3);
    expect(g.state.cards[self]?.renowned).toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[self]?.renowned).toBe(false);
    expect(plusOnes(g, self)).toBe(0);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    // Back on turn 3 it is summoning sick; its next combat is turn 5's.
    hit(g, self, 5);
    expect(plusOnes(g, self)).toBe(1);
    expect(g.state.cards[self]?.renowned).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, self } = board();
    hit(g, self, 3);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
