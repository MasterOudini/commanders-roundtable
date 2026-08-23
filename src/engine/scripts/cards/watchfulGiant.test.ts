// `Watchful Giant` — the twin of Voice of the Provinces: one 1/1 white Human,
// mine.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WATCHFUL_GIANT_SCRIPT } from './watchfulGiant';
import { advanceUntil, battlefieldOf, deps, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GIANT = 'Watchful Giant';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[GIANT], []],
    scripts: createRegistry([WATCHFUL_GIANT_SCRIPT]),
  });
  put(g, 'p1', GIANT);
  settle(g);
  return g;
}

describe('Watchful Giant', () => {
  test('one 1/1 white Human, under MY control', () => {
    const g = entered();
    const humans = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Human');
    expect(humans).toHaveLength(1);
    const d = deps(createRegistry([WATCHFUL_GIANT_SCRIPT]));
    const token = humans[0] as InstanceId;
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
