// `Nyx-Fleece Ram` — MY upkeep gains 1; the opponent's paid nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NYX_FLEECE_RAM_SCRIPT } from './nyxFleeceRam';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Nyx-Fleece Ram', () => {
  test('MY next upkeep gains exactly 1 — turn 2 paid nothing', () => {
    const g = startedGame({
      players: 2,
      decks: [['Nyx-Fleece Ram'], []],
      scripts: createRegistry([NYX_FLEECE_RAM_SCRIPT]),
    });
    put(g, 'p1', 'Nyx-Fleece Ram');
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber >= 3 && s.turn.phase === 'precombatMain',
      60_000,
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Nyx-Fleece Ram'], []],
      scripts: createRegistry([NYX_FLEECE_RAM_SCRIPT]),
    });
    put(g, 'p1', 'Nyx-Fleece Ram');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
