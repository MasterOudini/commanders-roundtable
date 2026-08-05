// `City Pigeon` — LEAVING (to hand, not a graveyard) makes the Food.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CITY_PIGEON_SCRIPT } from './cityPigeon';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PIGEON = 'City Pigeon';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('City Pigeon', () => {
  test('bouncing it to hand creates a Food — leaves, not dies', () => {
    const g = startedGame({
      players: 2,
      decks: [[PIGEON], []],
      scripts: createRegistry([CITY_PIGEON_SCRIPT]),
    });
    const pigeon = put(g, 'p1', PIGEON);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food')).toHaveLength(0);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: pigeon, to: { kind: 'hand', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[PIGEON], []],
      scripts: createRegistry([CITY_PIGEON_SCRIPT]),
    });
    const pigeon = put(g, 'p1', PIGEON);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: pigeon, to: { kind: 'hand', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
