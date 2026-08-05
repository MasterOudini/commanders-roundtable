// `Blood Servitor` — the ETB Blood token, real on the battlefield.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLOOD_SERVITOR_SCRIPT } from './bloodServitor';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SERVITOR = 'Blood Servitor';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Blood Servitor', () => {
  test('entering creates a real Blood token', () => {
    const g = startedGame({
      players: 2,
      decks: [[SERVITOR], []],
      scripts: createRegistry([BLOOD_SERVITOR_SCRIPT]),
    });
    put(g, 'p1', SERVITOR);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Blood')).toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SERVITOR], []],
      scripts: createRegistry([BLOOD_SERVITOR_SCRIPT]),
    });
    put(g, 'p1', SERVITOR);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
