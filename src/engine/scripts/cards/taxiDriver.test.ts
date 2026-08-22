// `Taxi Driver` — the {1}, {T} haste grant, read DERIVED and gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TAXI_DRIVER_SCRIPT } from './taxiDriver';
import { derive } from '../../derive';
import { advanceUntil, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DRIVER = 'Taxi Driver';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DRIVER, BEARS], []],
    scripts: createRegistry([TAXI_DRIVER_SCRIPT]),
  });
  const driver = put(g, 'p1', DRIVER);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  // The {T} needs the Driver past summoning sickness (CR 302.6).
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    40_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: driver, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Taxi Driver', () => {
  test('the target gains haste', () => {
    const { g, bears } = granted();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(true);
  });

  test('the haste ENDS at cleanup, and it replays to the same hash', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
