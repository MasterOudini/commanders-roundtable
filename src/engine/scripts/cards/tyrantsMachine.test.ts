// `Tyrant's Machine` — Trip Noose's shape one cost over.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TYRANTS_MACHINE_SCRIPT } from './tyrantsMachine';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MACHINE = "Tyrant's Machine";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tapped(): { g: Game; machine: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MACHINE], [BEARS]],
    scripts: createRegistry([TYRANTS_MACHINE_SCRIPT]),
  });
  const machine = put(g, 'p1', MACHINE);
  const victim = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: machine, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, machine, victim };
}

describe("Tyrant's Machine", () => {
  test('the creature turns, and the Machine turned to pay for it', () => {
    const { g, machine, victim } = tapped();
    expect(g.state.cards[victim]?.tapped).toBe(true);
    expect(g.state.cards[machine]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = tapped();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
