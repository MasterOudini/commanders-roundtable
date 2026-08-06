// `Dwarven Castle Guard` — dying leaves the 1/1 Hero behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DWARVEN_CASTLE_GUARD_SCRIPT } from './dwarvenCastleGuard';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GUARD = 'Dwarven Castle Guard';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Dwarven Castle Guard', () => {
  test('dying creates the 1/1 Hero', () => {
    const g = startedGame({
      players: 2,
      decks: [[GUARD], []],
      scripts: createRegistry([DWARVEN_CASTLE_GUARD_SCRIPT]),
    });
    const guard = put(g, 'p1', GUARD);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: guard, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Hero')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[GUARD], []],
      scripts: createRegistry([DWARVEN_CASTLE_GUARD_SCRIPT]),
    });
    const guard = put(g, 'p1', GUARD);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: guard, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
