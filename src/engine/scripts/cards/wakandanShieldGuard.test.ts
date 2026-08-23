// `Wakandan Shield Guard` — the entry makes one 1/1 white Soldier under my
// control.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WAKANDAN_SHIELD_GUARD_SCRIPT } from './wakandanShieldGuard';
import { advanceUntil, battlefieldOf, deps, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GUARD = 'Wakandan Shield Guard';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[GUARD], []],
    scripts: createRegistry([WAKANDAN_SHIELD_GUARD_SCRIPT]),
  });
  put(g, 'p1', GUARD);
  settle(g);
  return g;
}

describe('Wakandan Shield Guard', () => {
  test('one 1/1 Soldier, mine', () => {
    const g = entered();
    const soldiers = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Soldier');
    expect(soldiers).toHaveLength(1);
    const d = deps(createRegistry([WAKANDAN_SHIELD_GUARD_SCRIPT]));
    const token = soldiers[0] as InstanceId;
    const got = derive(g.state, d.oracle, d.scripts, token);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 1, toughness: 1 });
    expect(got.colors).toContain('W');
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
