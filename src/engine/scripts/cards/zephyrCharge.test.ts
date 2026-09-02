// `Zephyr Charge` — the {1}{U} flying grant, repeatable, gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZEPHYR_CHARGE_SCRIPT } from './zephyrCharge';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHARGE = 'Zephyr Charge';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; charge: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CHARGE, BEARS], []],
    scripts: createRegistry([ZEPHYR_CHARGE_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const charge = put(g, 'p1', CHARGE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: charge, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, charge, bears };
}

function flies(g: Game, id: InstanceId): boolean {
  const d = deps(createRegistry([ZEPHYR_CHARGE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords.has('flying');
}

describe('Zephyr Charge', () => {
  test('the target gains flying, and it goes TWICE in one turn', () => {
    const { g, charge, bears } = granted();
    expect(flies(g, bears)).toBe(true);
    const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: charge, abilityIndex: 0 });
    expect(again.ok).toBe(true);
  });

  test('cleanup takes it back (CR 514.2)', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(flies(g, bears)).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
