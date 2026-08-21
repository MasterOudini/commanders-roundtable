// `Primeval Light` — only the targeted player's enchantments burn away.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRIMEVAL_LIGHT_SCRIPT } from './primevalLight';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function lit(): { g: Game; theirs: string; theirs2: string; mine: string } {
  const g = startedGame({
    players: 2,
    decks: [['Primeval Light', 'Insight'], ['Contemplation', 'Insight']],
    scripts: createRegistry([PRIMEVAL_LIGHT_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Contemplation');
  const theirs2 = put(g, 'p2', 'Insight');
  const mine = put(g, 'p1', 'Insight');
  settle(g);
  const spell = put(g, 'p1', 'Primeval Light', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }),
  );
  settle(g);
  return { g, theirs, theirs2, mine };
}

describe('Primeval Light', () => {
  test('both of the target enchantments die; mine survives', () => {
    const { g, theirs, theirs2, mine } = lit();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs2]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = lit();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
