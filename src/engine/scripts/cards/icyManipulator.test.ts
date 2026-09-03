// `Icy Manipulator` — an artifact taps the turn it lands (no summoning
// sickness for artifacts): their creature, then a land, each tapped; a player
// is refused (the list names no player).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ICY_MANIPULATOR_SCRIPT } from './icyManipulator';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Icy Manipulator';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; self: InstanceId; bears: InstanceId; island: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD], [BEARS, 'Island']], scripts: createRegistry([ICY_MANIPULATOR_SCRIPT]) });
  const self = put(g, 'p1', CARD);
  const bears = put(g, 'p2', BEARS);
  const island = put(g, 'p2', 'Island');
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, self, bears, island };
}

describe('Icy Manipulator', () => {
  test('taps their creature, and itself', () => {
    const { g, self, bears } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('taps a land (the list names lands)', () => {
    const { g, island } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: island }] }));
    settle(g);
    expect(g.state.cards[island]?.tapped).toBe(true);
  });

  test('a player is refused (the list names no player)', () => {
    const { g } = placed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bears } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
