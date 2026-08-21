// `Shatter the Sky` — only the power-4 controller draws, then everything
// dies; the indestructible stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHATTER_THE_SKY_SCRIPT } from './shatterTheSky';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shattered(): { g: Game; maw: InstanceId; bears: InstanceId; myr: InstanceId; mine: number; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Shatter the Sky', 'Colossal Dreadmaw'],
      ['Grizzly Bears', 'Darksteel Myr'],
    ],
    scripts: createRegistry([SHATTER_THE_SKY_SCRIPT]),
  });
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Shatter the Sky', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length;
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, maw, bears, myr, mine, theirs };
}

describe('Shatter the Sky', () => {
  test('the power-4 controller draws, everything else dies, the Myr stands', () => {
    const { g, maw, bears, myr, mine, theirs } = shattered();
    expect(g.state.cards[maw]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
    // I controlled the 6/6, so I draw: the spell left and a card came.
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine - 1 + 1);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs);
  });

  test('replays to the same hash', () => {
    const { g } = shattered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
