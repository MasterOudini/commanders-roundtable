// `Muse Drake` — the entry draws one, counted in LOG MOVES (the D169
// put()-fetch trap).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MUSE_DRAKE_SCRIPT } from './museDrake';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Muse Drake', () => {
  test('entering draws a card', () => {
    const g = startedGame({
      players: 2,
      decks: [['Muse Drake'], []],
      scripts: createRegistry([MUSE_DRAKE_SCRIPT]),
    });
    settle(g);
    const logAt = g.log.length;
    put(g, 'p1', 'Muse Drake');
    settle(g);
    const draws = g.log
      .slice(logAt)
      .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
      .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === 'p1');
    expect(draws).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Muse Drake'], []],
      scripts: createRegistry([MUSE_DRAKE_SCRIPT]),
    });
    put(g, 'p1', 'Muse Drake');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
