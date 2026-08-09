// `Flamekin Gildweaver` — entering brings the Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FLAMEKIN_GILDWEAVER_SCRIPT } from './flamekinGildweaver';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GILDWEAVER = 'Flamekin Gildweaver';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Flamekin Gildweaver', () => {
  test('entering creates a Treasure token', () => {
    const g = startedGame({
      players: 2,
      decks: [[GILDWEAVER], []],
      scripts: createRegistry([FLAMEKIN_GILDWEAVER_SCRIPT]),
    });
    put(g, 'p1', GILDWEAVER);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[GILDWEAVER], []],
      scripts: createRegistry([FLAMEKIN_GILDWEAVER_SCRIPT]),
    });
    put(g, 'p1', GILDWEAVER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
