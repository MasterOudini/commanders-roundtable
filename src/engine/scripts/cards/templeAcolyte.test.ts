// `Temple Acolyte` — the plain ETB gain at three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEMPLE_ACOLYTE_SCRIPT } from './templeAcolyte';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ACOLYTE = 'Temple Acolyte';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[ACOLYTE], []],
    scripts: createRegistry([TEMPLE_ACOLYTE_SCRIPT]),
  });
  put(g, 'p1', ACOLYTE);
  settle(g);
  return g;
}

describe('Temple Acolyte', () => {
  test('entering gains 3 life', () => {
    expect(entered().state.players.p1?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
