// `Frostbridge Guard` — the white tap, past summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FROSTBRIDGE_GUARD_SCRIPT } from './frostbridgeGuard';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GUARD = 'Frostbridge Guard';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; guard: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GUARD], [BEARS]],
    scripts: createRegistry([FROSTBRIDGE_GUARD_SCRIPT]),
  });
  const guard = put(g, 'p1', GUARD);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, guard, theirs };
}

describe('Frostbridge Guard', () => {
  test('taps the target creature', () => {
    const { g, guard, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: guard, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, guard, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: guard, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
