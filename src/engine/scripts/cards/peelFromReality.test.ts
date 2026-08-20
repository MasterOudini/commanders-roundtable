// `Peel from Reality` — one of yours and one of theirs, both to hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PEEL_FROM_REALITY_SCRIPT } from './peelFromReality';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function peeled(): { g: Game; mine: string; theirs: string } {
  const g = startedGame({
    players: 2,
    decks: [['Peel from Reality', 'Grizzly Bears'], ['Colossal Dreadmaw']],
    scripts: createRegistry([PEEL_FROM_REALITY_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  const spell = put(g, 'p1', 'Peel from Reality', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['U', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Peel from Reality', () => {
  test('bounces both creatures to their owners hands', () => {
    const { g, mine, theirs } = peeled();
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'hand', player: 'p2' });
  });

  test('replays to the same hash', () => {
    const { g } = peeled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
