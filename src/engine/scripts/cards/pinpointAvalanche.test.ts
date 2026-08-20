// `Pinpoint Avalanche` — four damage kills a 4/4 and leaves a 6/6
// standing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PINPOINT_AVALANCHE_SCRIPT } from './pinpointAvalanche';
import { advanceUntil, find, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function avalanched(name: string): { g: Game; target: string } {
  const g = startedGame({
    players: 2,
    decks: [['Pinpoint Avalanche'], ['Air Elemental', 'Colossal Dreadmaw']],
    scripts: createRegistry([PINPOINT_AVALANCHE_SCRIPT]),
  });
  put(g, 'p2', 'Air Elemental');
  put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  const target = find(g, 'p2', 'battlefield', name) as string;
  const spell = put(g, 'p1', 'Pinpoint Avalanche', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['R', 'R', 'C', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: target }] }),
  );
  settle(g);
  return { g, target };
}

describe('Pinpoint Avalanche', () => {
  test('a 4/4 dies to exactly four', () => {
    const { g, target } = avalanched('Air Elemental');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('a 6/6 wears four and stands', () => {
    const { g, target } = avalanched('Colossal Dreadmaw');
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = avalanched('Air Elemental');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
