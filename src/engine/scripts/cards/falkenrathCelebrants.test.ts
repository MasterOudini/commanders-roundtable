// `Falkenrath Celebrants` — TWO distinct Blood tokens on entry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FALKENRATH_CELEBRANTS_SCRIPT } from './falkenrathCelebrants';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CELEBRANTS = 'Falkenrath Celebrants';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Falkenrath Celebrants', () => {
  test('entering creates two DISTINCT Blood tokens', () => {
    const g = startedGame({
      players: 2,
      decks: [[CELEBRANTS], []],
      scripts: createRegistry([FALKENRATH_CELEBRANTS_SCRIPT]),
    });
    put(g, 'p1', CELEBRANTS);
    settle(g);
    const tokens = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Blood');
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CELEBRANTS], []],
      scripts: createRegistry([FALKENRATH_CELEBRANTS_SCRIPT]),
    });
    put(g, 'p1', CELEBRANTS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
