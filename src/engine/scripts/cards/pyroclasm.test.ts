// `Pyroclasm` — two damage everywhere: the small die, the big shrug it
// off.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PYROCLASM_SCRIPT } from './pyroclasm';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function melted(): { g: Game; mine: string; theirs: string; big: string } {
  const g = startedGame({
    players: 2,
    decks: [['Pyroclasm', 'Grizzly Bears'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([PYROCLASM_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  const spell = put(g, 'p1', 'Pyroclasm', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, big };
}

describe('Pyroclasm', () => {
  test('both 2/2s die — mine included — and the 6/6 stands', () => {
    const { g, mine, theirs, big } = melted();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = melted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
