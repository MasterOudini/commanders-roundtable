// `Aven Battle Priest` — the self-ETB gain, on the controller.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AVEN_BATTLE_PRIEST_SCRIPT } from './avenBattlePriest';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PRIEST = 'Aven Battle Priest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Aven Battle Priest', () => {
  test('entering gains its controller 3 life', () => {
    const g = startedGame({
      players: 2,
      decks: [[PRIEST], []],
      scripts: createRegistry([AVEN_BATTLE_PRIEST_SCRIPT]),
    });
    put(g, 'p1', PRIEST);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[PRIEST], []],
      scripts: createRegistry([AVEN_BATTLE_PRIEST_SCRIPT]),
    });
    put(g, 'p1', PRIEST);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
