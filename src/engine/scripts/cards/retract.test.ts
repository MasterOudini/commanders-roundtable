// `Retract` — my artifacts come home; theirs stay.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RETRACT_SCRIPT } from './retract';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function retracted(): { g: Game; mine: string; mine2: string; theirs: string } {
  const g = startedGame({
    players: 2,
    decks: [['Retract', 'Sol Ring', 'Mind Stone'], ['Sol Ring']],
    scripts: createRegistry([RETRACT_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Sol Ring');
  const mine2 = put(g, 'p1', 'Mind Stone');
  const theirs = put(g, 'p2', 'Sol Ring');
  settle(g);
  const spell = put(g, 'p1', 'Retract', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, mine2, theirs };
}

describe('Retract', () => {
  test('both of mine return to hand; theirs stays', () => {
    const { g, mine, mine2, theirs } = retracted();
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[mine2]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = retracted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
