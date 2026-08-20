// `Peace and Quiet` — two enchantments, one spell, both named as targets.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PEACE_AND_QUIET_SCRIPT } from './peaceAndQuiet';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function quieted(): { g: Game; a: string; b: string } {
  const g = startedGame({
    players: 2,
    decks: [['Peace and Quiet'], ['Contemplation', 'Insight']],
    scripts: createRegistry([PEACE_AND_QUIET_SCRIPT]),
  });
  const a = put(g, 'p2', 'Contemplation');
  const b = put(g, 'p2', 'Insight');
  settle(g);
  const spell = put(g, 'p1', 'Peace and Quiet', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['W', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [
        { kind: 'card', id: a },
        { kind: 'card', id: b },
      ],
    }),
  );
  settle(g);
  return { g, a, b };
}

describe('Peace and Quiet', () => {
  test('destroys both targeted enchantments', () => {
    const { g, a, b } = quieted();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = quieted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
