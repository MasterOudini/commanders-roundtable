// `Memorial to Folly` — the sacrifice returns a creature CARD from the
// graveyard to hand; a land card in the graveyard is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MEMORIAL_TO_FOLLY_SCRIPT } from './memorialToFolly';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MEMORIAL = 'Memorial to Folly';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; memorial: InstanceId; bears: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MEMORIAL, 'Grizzly Bears', 'Mountain'], []],
    scripts: createRegistry([MEMORIAL_TO_FOLLY_SCRIPT]),
  });
  const memorial = put(g, 'p1', MEMORIAL);
  const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  const mountain = put(g, 'p1', 'Mountain', 'graveyard');
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [memorial], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: memorial, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, memorial, bears, mountain };
}

describe('Memorial to Folly', () => {
  test('a land card is refused; the creature card comes back to hand', () => {
    const { g, memorial, bears, mountain } = board();
    const res = g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: mountain }],
    });
    expect(res.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[memorial]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bears } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
