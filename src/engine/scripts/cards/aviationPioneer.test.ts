// `Aviation Pioneer` — the same colorless Thopter as Aspiring Aeronaut, from
// the same table entry, real on the battlefield.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AVIATION_PIONEER_SCRIPT } from './aviationPioneer';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PIONEER = 'Aviation Pioneer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Aviation Pioneer', () => {
  test('entering creates a real 1/1 Thopter token for its controller', () => {
    const g = startedGame({
      players: 2,
      decks: [[PIONEER], []],
      scripts: createRegistry([AVIATION_PIONEER_SCRIPT]),
    });
    put(g, 'p1', PIONEER);
    settle(g);
    const tokens = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Thopter');
    expect(tokens).toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[PIONEER], []],
      scripts: createRegistry([AVIATION_PIONEER_SCRIPT]),
    });
    put(g, 'p1', PIONEER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
