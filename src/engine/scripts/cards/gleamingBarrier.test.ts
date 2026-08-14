// `Gleaming Barrier` — dying pays the Treasure; a bounce is not dying.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GLEAMING_BARRIER_SCRIPT } from './gleamingBarrier';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BARRIER = 'Gleaming Barrier';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasures(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure').length;
}

function board(): Game {
  return startedGame({
    players: 2,
    decks: [[BARRIER], []],
    scripts: createRegistry([GLEAMING_BARRIER_SCRIPT]),
  });
}

describe('Gleaming Barrier', () => {
  test('dying creates the Treasure', () => {
    const g = board();
    const barrier = put(g, 'p1', BARRIER);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: barrier, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(treasures(g)).toBe(1);
  });

  test('a BOUNCE pays nothing — leaving is not dying', () => {
    const g = board();
    const barrier = put(g, 'p1', BARRIER);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: barrier, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(treasures(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const barrier = put(g, 'p1', BARRIER);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: barrier, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
