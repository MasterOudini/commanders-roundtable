// `Perish` — every green creature, both boards; nothing else.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PERISH_SCRIPT } from './perish';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function perished(): { g: Game; mine: string; theirs: string; spared: string } {
  const g = startedGame({
    players: 2,
    decks: [['Perish', 'Grizzly Bears'], ['Colossal Dreadmaw', 'Air Elemental']],
    scripts: createRegistry([PERISH_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  const spared = put(g, 'p2', 'Air Elemental');
  settle(g);
  const spell = put(g, 'p1', 'Perish', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['B', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, spared };
}

describe('Perish', () => {
  test('kills every green creature on both sides and spares the rest', () => {
    const { g, mine, theirs, spared } = perished();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[spared]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = perished();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
