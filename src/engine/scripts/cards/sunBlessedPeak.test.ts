// `Sun-Blessed Peak` — the land eats itself for a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUN_BLESSED_PEAK_SCRIPT } from './sunBlessedPeak';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function peaked(): { g: Game; land: InstanceId; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Sun-Blessed Peak'], []],
    scripts: createRegistry([SUN_BLESSED_PEAK_SCRIPT]),
  });
  const land = put(g, 'p1', 'Sun-Blessed Peak');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1 }));
  settle(g);
  return { g, land, before };
}

describe('Sun-Blessed Peak', () => {
  test('enters tapped, then trades itself for a card', () => {
    const { g, land, before } = peaked();
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g } = peaked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
