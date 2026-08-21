// `Reclaiming Vines` — all three arms of the triple, one at a time.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RECLAIMING_VINES_SCRIPT } from './reclaimingVines';
import { advanceUntil, find, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function vined(name: string): { g: Game; target: string } {
  const g = startedGame({
    players: 2,
    decks: [['Reclaiming Vines'], ['Sol Ring', 'Contemplation']],
    scripts: createRegistry([RECLAIMING_VINES_SCRIPT]),
  });
  put(g, 'p2', 'Sol Ring');
  put(g, 'p2', 'Contemplation');
  put(g, 'p2', 'Mountain');
  settle(g);
  const target = find(g, 'p2', 'battlefield', name) as string;
  const spell = put(g, 'p1', 'Reclaiming Vines', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: target }] }),
  );
  settle(g);
  return { g, target };
}

describe('Reclaiming Vines', () => {
  test('the artifact arm takes a Sol Ring', () => {
    const { g, target } = vined('Sol Ring');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('the enchantment arm takes a Contemplation', () => {
    const { g, target } = vined('Contemplation');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('the land arm takes a Mountain', () => {
    const { g, target } = vined('Mountain');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = vined('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
