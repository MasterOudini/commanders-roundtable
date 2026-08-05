// `Common Crook` — dying leaves a Treasure behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COMMON_CROOK_SCRIPT } from './commonCrook';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CROOK = 'Common Crook';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Common Crook', () => {
  test('dying creates a real Treasure token', () => {
    const g = startedGame({
      players: 2,
      decks: [[CROOK], []],
      scripts: createRegistry([COMMON_CROOK_SCRIPT]),
    });
    const crook = put(g, 'p1', CROOK);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: crook, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CROOK], []],
      scripts: createRegistry([COMMON_CROOK_SCRIPT]),
    });
    const crook = put(g, 'p1', CROOK);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: crook, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
