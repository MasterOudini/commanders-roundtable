// `Beetleback Chief` — TWO Goblins from one trigger, counted.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BEETLEBACK_CHIEF_SCRIPT } from './beetlebackChief';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CHIEF = 'Beetleback Chief';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Beetleback Chief', () => {
  test('entering creates TWO real 1/1 Goblin tokens', () => {
    const g = startedGame({
      players: 2,
      decks: [[CHIEF], []],
      scripts: createRegistry([BEETLEBACK_CHIEF_SCRIPT]),
    });
    put(g, 'p1', CHIEF);
    settle(g);
    const goblins = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Goblin');
    expect(goblins).toHaveLength(2);
    // ⚠️ DISTINCT ids — with the pre-D164 non-advancing allocator this count
    // read 2 from a DUPLICATED zone entry of one overwritten card. The set
    // size is the real assertion.
    expect(new Set(goblins).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CHIEF], []],
      scripts: createRegistry([BEETLEBACK_CHIEF_SCRIPT]),
    });
    put(g, 'p1', CHIEF);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
