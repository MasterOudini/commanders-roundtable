// `Searchlight Companion` — entering deploys the colorless Spirit.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEARCHLIGHT_COMPANION_SCRIPT } from './searchlightCompanion';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function lit(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Searchlight Companion'], []],
    scripts: createRegistry([SEARCHLIGHT_COMPANION_SCRIPT]),
  });
  put(g, 'p1', 'Searchlight Companion');
  settle(g);
  return g;
}

describe('Searchlight Companion', () => {
  test('entering deploys one Spirit token', () => {
    const g = lit();
    expect(tokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = lit();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
