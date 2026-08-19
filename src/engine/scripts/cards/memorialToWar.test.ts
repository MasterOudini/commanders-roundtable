// `Memorial to War` — destroys the land; Darksteel Citadel survives it and
// the Memorial STAYS SPENT (no refund on an indestructible target).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MEMORIAL_TO_WAR_SCRIPT } from './memorialToWar';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MEMORIAL = 'Memorial to War';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(land: string): { g: Game; memorial: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MEMORIAL], [land]],
    scripts: createRegistry([MEMORIAL_TO_WAR_SCRIPT]),
  });
  const memorial = put(g, 'p1', MEMORIAL);
  const theirs = put(g, 'p2', land);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [memorial], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: memorial, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, memorial, land: theirs };
}

describe('Memorial to War', () => {
  test('destroys the targeted land', () => {
    const { g, memorial, land } = board('Mountain');
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[memorial]?.zone.kind).toBe('graveyard');
  });

  test('Darksteel Citadel survives — and the Memorial stays spent', () => {
    const { g, memorial, land } = board('Darksteel Citadel');
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[memorial]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = board('Mountain');
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
