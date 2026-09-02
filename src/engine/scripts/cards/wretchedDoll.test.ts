// `Wretched Doll` — {B},{T}: a SURVEIL 1 (toGraveyard), past summoning
// sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WRETCHED_DOLL_SCRIPT } from './wretchedDoll';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DOLL = 'Wretched Doll';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function activated(): { g: Game; doll: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[DOLL], []],
    scripts: createRegistry([WRETCHED_DOLL_SCRIPT]),
  });
  const doll = put(g, 'p1', DOLL);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: doll, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, doll, revealed };
}

describe('Wretched Doll', () => {
  test('it taps and asks a SURVEIL 1', () => {
    const { g, doll, revealed } = activated();
    expect(revealed).toHaveLength(1);
    expect(g.state.cards[doll]?.tapped).toBe(true);
    expect(
      g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard,
    ).toBe(true);
  });

  test('a binned card reaches the GRAVEYARD', () => {
    const { g, revealed } = activated();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
    settle(g);
    expect(g.state.cards[top]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = activated();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
