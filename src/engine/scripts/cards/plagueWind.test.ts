// `Plague Wind` — everyone else's creatures die; the caster's stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PLAGUE_WIND_SCRIPT } from './plagueWind';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function winded(): { g: Game; mine: string; theirs: string; theirsBig: string } {
  const g = startedGame({
    players: 2,
    decks: [['Plague Wind', 'Grizzly Bears'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([PLAGUE_WIND_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const theirsBig = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  const spell = put(g, 'p1', 'Plague Wind', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, theirsBig };
}

describe('Plague Wind', () => {
  test('sweeps only the other side of the table', () => {
    const { g, mine, theirs, theirsBig } = winded();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirsBig]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = winded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
