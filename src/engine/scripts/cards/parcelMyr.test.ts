// `Parcel Myr` — pays itself for a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PARCEL_MYR_SCRIPT } from './parcelMyr';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function parceled(): { g: Game; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Parcel Myr'], []],
    scripts: createRegistry([PARCEL_MYR_SCRIPT]),
  });
  const myr = put(g, 'p1', 'Parcel Myr');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, myr };
}

describe('Parcel Myr', () => {
  test('pays itself and draws', () => {
    const { g, myr } = parceled();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: myr, abilityIndex: 0 }));
    settle(g);
    expect(g.state.cards[myr]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, myr } = parceled();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: myr, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
