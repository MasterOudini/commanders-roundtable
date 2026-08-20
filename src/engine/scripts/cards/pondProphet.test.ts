// `Pond Prophet` — a card on arrival, counted in log moves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { POND_PROPHET_SCRIPT } from './pondProphet';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Pond Prophet', () => {
  test('entering draws exactly one', () => {
    const g = startedGame({
      players: 2,
      decks: [['Pond Prophet'], []],
      scripts: createRegistry([POND_PROPHET_SCRIPT]),
    });
    const logAt = g.log.length;
    put(g, 'p1', 'Pond Prophet');
    settle(g);
    const drew = g.log
      .slice(logAt)
      .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
      .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').length;
    expect(drew).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Pond Prophet'], []],
      scripts: createRegistry([POND_PROPHET_SCRIPT]),
    });
    put(g, 'p1', 'Pond Prophet');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
