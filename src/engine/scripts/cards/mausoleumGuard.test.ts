// `Mausoleum Guard` — dying pays TWO Spirits, and they are distinct tokens.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MAUSOLEUM_GUARD_SCRIPT } from './mausoleumGuard';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GUARD = 'Mausoleum Guard';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Mausoleum Guard', () => {
  test('dying pays two DISTINCT Spirit tokens', () => {
    const g = startedGame({
      players: 2,
      decks: [[GUARD], []],
      scripts: createRegistry([MAUSOLEUM_GUARD_SCRIPT]),
    });
    const guard = put(g, 'p1', GUARD);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: guard,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    const spirits = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Spirit');
    expect(spirits).toHaveLength(2);
    expect(new Set(spirits).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[GUARD], []],
      scripts: createRegistry([MAUSOLEUM_GUARD_SCRIPT]),
    });
    const guard = put(g, 'p1', GUARD);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: guard,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
