// `Brazen Freebooter` — the ETB Treasure, real on the battlefield.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRAZEN_FREEBOOTER_SCRIPT } from './brazenFreebooter';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const FREEBOOTER = 'Brazen Freebooter';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Brazen Freebooter', () => {
  test('entering creates a real Treasure token', () => {
    const g = startedGame({
      players: 2,
      decks: [[FREEBOOTER], []],
      scripts: createRegistry([BRAZEN_FREEBOOTER_SCRIPT]),
    });
    put(g, 'p1', FREEBOOTER);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure')).toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[FREEBOOTER], []],
      scripts: createRegistry([BRAZEN_FREEBOOTER_SCRIPT]),
    });
    put(g, 'p1', FREEBOOTER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
