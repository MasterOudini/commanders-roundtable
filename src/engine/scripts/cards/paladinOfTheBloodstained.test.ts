// `Paladin of the Bloodstained` — the entry brings a lifelink Vampire.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PALADIN_OF_THE_BLOODSTAINED_SCRIPT } from './paladinOfTheBloodstained';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function vampires(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Vampire';
  }).length;
}

describe('Paladin of the Bloodstained', () => {
  test('entering brings a Vampire token', () => {
    const g = startedGame({
      players: 2,
      decks: [['Paladin of the Bloodstained'], []],
      scripts: createRegistry([PALADIN_OF_THE_BLOODSTAINED_SCRIPT]),
    });
    put(g, 'p1', 'Paladin of the Bloodstained');
    settle(g);
    expect(vampires(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Paladin of the Bloodstained'], []],
      scripts: createRegistry([PALADIN_OF_THE_BLOODSTAINED_SCRIPT]),
    });
    put(g, 'p1', 'Paladin of the Bloodstained');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
