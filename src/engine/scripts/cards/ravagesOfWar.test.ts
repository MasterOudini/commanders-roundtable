// `Ravages of War` — every land on every board.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAVAGES_OF_WAR_SCRIPT } from './ravagesOfWar';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ravaged(): { g: Game; mine: string; theirs: string; bears: string } {
  const g = startedGame({
    players: 2,
    decks: [['Ravages of War'], ['Grizzly Bears']],
    scripts: createRegistry([RAVAGES_OF_WAR_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Forest');
  const theirs = put(g, 'p2', 'Mountain');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Ravages of War', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, bears };
}

describe('Ravages of War', () => {
  test('both lands die; the creature does not', () => {
    const { g, mine, theirs, bears } = ravaged();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = ravaged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
