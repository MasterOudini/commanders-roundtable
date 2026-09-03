// `Wanderbrine Trapper` — its own tap plus ANOTHER untapped creature of mine
// tapped: the opponent's creature is tapped; naming the Trapper as the
// other creature is refused; my own creature is refused as the target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WANDERBRINE_TRAPPER_SCRIPT } from './wanderbrineTrapper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TRAPPER = 'Wanderbrine Trapper';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; trapper: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TRAPPER, BEARS], [BEARS]],
    scripts: createRegistry([WANDERBRINE_TRAPPER_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const trapper = put(g, 'p1', TRAPPER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, trapper, mine, theirs };
}

describe('Wanderbrine Trapper (tap ANOTHER)', () => {
  test('my bear taps beside the Trapper; their bear is tapped', () => {
    const { g, trapper, mine, theirs } = ready();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: trapper, abilityIndex: 0, tap: [mine] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[mine]?.tapped).toBe(true);
    expect(g.state.cards[trapper]?.tapped).toBe(true);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('the Trapper cannot be the "another" creature', () => {
    const { g, trapper } = ready();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: trapper, abilityIndex: 0, tap: [trapper] }).ok).toBe(false);
    expect(g.state.cards[trapper]?.tapped).toBe(false);
  });

  test('my own creature is refused as the target', () => {
    const { g, trapper, mine } = ready();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: trapper, abilityIndex: 0, tap: [mine] }));
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, trapper, mine, theirs } = ready();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: trapper, abilityIndex: 0, tap: [mine] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
