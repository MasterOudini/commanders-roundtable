// `Sigil of the Empty Throne` — an enchantment cast pays an Angel; a
// creature cast pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SIGIL_OF_THE_EMPTY_THRONE_SCRIPT } from './sigilOfTheEmptyThrone';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function sigiled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sigil of the Empty Throne', 'Captive Flame', 'Grizzly Bears'], []],
    scripts: createRegistry([SIGIL_OF_THE_EMPTY_THRONE_SCRIPT]),
  });
  put(g, 'p1', 'Sigil of the Empty Throne');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

describe('Sigil of the Empty Throne', () => {
  test('an enchantment cast pays an Angel; a creature cast pays nothing', () => {
    const g = sigiled();
    const flame = put(g, 'p1', 'Captive Flame', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: flame }));
    settle(g);
    expect(tokens(g)).toBe(1);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(tokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = sigiled();
    const flame = put(g, 'p1', 'Captive Flame', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: flame }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
