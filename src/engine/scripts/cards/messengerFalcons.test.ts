// `Messenger Falcons` — the entry draws one, counted in LOG MOVES because
// put() may fetch the bird from the opening hand (the D169 counting trap).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MESSENGER_FALCONS_SCRIPT } from './messengerFalcons';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Messenger Falcons', () => {
  test('entering draws a card', () => {
    const g = startedGame({
      players: 2,
      decks: [['Messenger Falcons'], []],
      scripts: createRegistry([MESSENGER_FALCONS_SCRIPT]),
    });
    settle(g);
    const logAt = g.log.length;
    put(g, 'p1', 'Messenger Falcons');
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
      decks: [['Messenger Falcons'], []],
      scripts: createRegistry([MESSENGER_FALCONS_SCRIPT]),
    });
    put(g, 'p1', 'Messenger Falcons');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
