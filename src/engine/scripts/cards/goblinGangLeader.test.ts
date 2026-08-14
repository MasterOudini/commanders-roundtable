// `Goblin Gang Leader` — TWO Goblins with DISTINCT ids (D164's teeth).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_GANG_LEADER_SCRIPT } from './goblinGangLeader';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const LEADER = 'Goblin Gang Leader';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Goblin Gang Leader', () => {
  test('entering creates two DISTINCT 1/1 Goblins', () => {
    const g = startedGame({
      players: 2,
      decks: [[LEADER], []],
      scripts: createRegistry([GOBLIN_GANG_LEADER_SCRIPT]),
    });
    put(g, 'p1', LEADER);
    settle(g);
    const goblins = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Goblin');
    expect(goblins).toHaveLength(2);
    expect(new Set(goblins).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[LEADER], []],
      scripts: createRegistry([GOBLIN_GANG_LEADER_SCRIPT]),
    });
    put(g, 'p1', LEADER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
