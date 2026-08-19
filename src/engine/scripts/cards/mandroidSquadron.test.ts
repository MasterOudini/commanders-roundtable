// `Mandroid Squadron` — entering gains its controller 2 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MANDROID_SQUADRON_SCRIPT } from './mandroidSquadron';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SQUADRON = 'Mandroid Squadron';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Mandroid Squadron', () => {
  test('entering gains 2 life', () => {
    const g = startedGame({
      players: 2,
      decks: [[SQUADRON], []],
      scripts: createRegistry([MANDROID_SQUADRON_SCRIPT]),
    });
    put(g, 'p1', SQUADRON);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SQUADRON], []],
      scripts: createRegistry([MANDROID_SQUADRON_SCRIPT]),
    });
    put(g, 'p1', SQUADRON);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
