// `Predator, Flagship` — the pairing the card was printed for: {2} lifts a
// ground creature into the air, and {5}, {T} then destroys it, because the
// destroy reads DERIVED keywords (D289). Without the lift the Bears is
// refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PREDATOR_FLAGSHIP_SCRIPT } from './predatorFlagship';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Predator, Flagship';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; ship: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD], [BEARS]], scripts: createRegistry([PREDATOR_FLAGSHIP_SCRIPT]) });
  const ship = put(g, 'p1', CARD);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  return { g, ship, bears };
}

function lift(g: Game, ship: InstanceId, bears: InstanceId): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ship, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
}

describe('Predator, Flagship', () => {
  test('a ground creature is refused by the destroy until it is lifted', () => {
    const { g, ship, bears } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ship, abilityIndex: 1 }));
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('lifted, the Bears flies (derived) and the destroy takes it', () => {
    const { g, ship, bears } = placed();
    lift(g, ship, bears);
    const d = deps(createRegistry([PREDATOR_FLAGSHIP_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, bears).keywords.has('flying')).toBe(true);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ship, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[ship]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, ship, bears } = placed();
    lift(g, ship, bears);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
