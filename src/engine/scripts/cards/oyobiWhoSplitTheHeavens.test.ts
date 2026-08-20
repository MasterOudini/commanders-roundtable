// `Oyobi, Who Split the Heavens` — a Spirit cast pays a 3/3 Spirit; a
// Bears cast pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OYOBI_WHO_SPLIT_THE_HEAVENS_SCRIPT } from './oyobiWhoSplitTheHeavens';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spirits(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Spirit';
  }).length;
}

function split(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Oyobi, Who Split the Heavens', 'Nebelgast Herald', 'Grizzly Bears'], []],
    scripts: createRegistry([OYOBI_WHO_SPLIT_THE_HEAVENS_SCRIPT]),
  });
  put(g, 'p1', 'Oyobi, Who Split the Heavens');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const herald = put(g, 'p1', 'Nebelgast Herald', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: herald }));
  settle(g);
  return g;
}

describe('Oyobi, Who Split the Heavens', () => {
  test('a Spirit cast pays a 3/3 Spirit; a Bears cast pays nothing', () => {
    const g = split();
    expect(spirits(g)).toBe(1);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(spirits(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = split();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
