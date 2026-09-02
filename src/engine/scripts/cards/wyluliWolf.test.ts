// `Wyluli Wolf` — {T} pumps a target +1/+1, gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WYLULI_WOLF_SCRIPT } from './wyluliWolf';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WOLF = 'Wyluli Wolf';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; wolf: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WOLF, BEARS], []],
    scripts: createRegistry([WYLULI_WOLF_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const wolf = put(g, 'p1', WOLF);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: wolf, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, wolf, bears };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([WYLULI_WOLF_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Wyluli Wolf', () => {
  test('the target is 3/3 and the Wolf is tapped', () => {
    const { g, wolf, bears } = granted();
    expect(pt(g, bears)).toEqual({ power: 3, toughness: 3 });
    expect(g.state.cards[wolf]?.tapped).toBe(true);
  });

  test('cleanup takes it back (CR 514.2)', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
