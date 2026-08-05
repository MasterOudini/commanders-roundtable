// `Aspiring Aeronaut` — the colorless Thopter, real on the battlefield.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ASPIRING_AERONAUT_SCRIPT } from './aspiringAeronaut';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const AERONAUT = 'Aspiring Aeronaut';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Aspiring Aeronaut', () => {
  test('entering creates a real 1/1 Thopter token for its controller', () => {
    const g = startedGame({
      players: 2,
      decks: [[AERONAUT], []],
      scripts: createRegistry([ASPIRING_AERONAUT_SCRIPT]),
    });
    put(g, 'p1', AERONAUT);
    settle(g);
    const tokens = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Thopter');
    expect(tokens).toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[AERONAUT], []],
      scripts: createRegistry([ASPIRING_AERONAUT_SCRIPT]),
    });
    put(g, 'p1', AERONAUT);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
