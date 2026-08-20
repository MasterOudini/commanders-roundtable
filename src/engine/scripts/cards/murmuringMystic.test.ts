// `Murmuring Mystic` — my instant pays a Bird Illusion; a creature cast
// pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MURMURING_MYSTIC_SCRIPT } from './murmuringMystic';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function birds(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Bird Illusion';
  }).length;
}

function mystified(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Murmuring Mystic', 'Lightning Bolt', 'Grizzly Bears'], []],
    scripts: createRegistry([MURMURING_MYSTIC_SCRIPT]),
  });
  put(g, 'p1', 'Murmuring Mystic');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }),
  );
  settle(g);
  return g;
}

describe('Murmuring Mystic', () => {
  test('my Bolt pays a Bird Illusion; a creature cast pays nothing', () => {
    const g = mystified();
    expect(birds(g)).toBe(1);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(birds(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = mystified();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
