// `Satyr Enchanter` — an enchantment cast draws; a creature cast does
// not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SATYR_ENCHANTER_SCRIPT } from './satyrEnchanter';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function enchanted(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Satyr Enchanter', 'Captive Flame', 'Grizzly Bears'], []],
    scripts: createRegistry([SATYR_ENCHANTER_SCRIPT]),
  });
  put(g, 'p1', 'Satyr Enchanter');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

describe('Satyr Enchanter', () => {
  test('an enchantment cast draws; a creature cast does not', () => {
    const g = enchanted();
    const flame = put(g, 'p1', 'Captive Flame', 'hand');
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: flame }));
    settle(g);
    // The Flame left the hand and the draw arrived: net zero.
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    const mid2 = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid2 - 1);
  });

  test('replays to the same hash', () => {
    const g = enchanted();
    const flame = put(g, 'p1', 'Captive Flame', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: flame }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
