// `Dromoka Dunecaster` — {1}{W}, {T} (turn 3) taps their ground creature;
// the flyer is refused ("without flying", D289).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DROMOKA_DUNECASTER_SCRIPT } from './dromokaDunecaster';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Dromoka Dunecaster';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; self: InstanceId; hawk: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD], [HAWK, BEARS]], scripts: createRegistry([DROMOKA_DUNECASTER_SCRIPT]) });
  const self = put(g, 'p1', CARD);
  const hawk = put(g, 'p2', HAWK);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, self, hawk, bears };
}

describe('Dromoka Dunecaster', () => {
  test('taps the ground creature and itself', () => {
    const { g, self, bears } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('the flyer is refused (D289)', () => {
    const { g, hawk } = placed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bears } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
