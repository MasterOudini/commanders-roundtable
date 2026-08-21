// `Spinning Wheel` — the #a1 tap turns the Bears; an artifact is never
// summoning-sick.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPINNING_WHEEL_SCRIPT } from './spinningWheel';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spun(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Spinning Wheel'], ['Grizzly Bears']],
    scripts: createRegistry([SPINNING_WHEEL_SCRIPT]),
  });
  const wheel = put(g, 'p1', 'Spinning Wheel');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: wheel, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Spinning Wheel', () => {
  test('the target turns', () => {
    const { g, bears } = spun();
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = spun();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
