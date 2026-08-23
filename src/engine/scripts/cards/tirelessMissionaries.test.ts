// `Tireless Missionaries` — the plain ETB gain at three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TIRELESS_MISSIONARIES_SCRIPT } from './tirelessMissionaries';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MISSIONARIES = 'Tireless Missionaries';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[MISSIONARIES], []],
    scripts: createRegistry([TIRELESS_MISSIONARIES_SCRIPT]),
  });
  put(g, 'p1', MISSIONARIES);
  settle(g);
  return g;
}

describe('Tireless Missionaries', () => {
  test('entering gains its controller 3 life, and nobody else', () => {
    const g = entered();
    expect(g.state.players.p1?.life).toBe(43);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
