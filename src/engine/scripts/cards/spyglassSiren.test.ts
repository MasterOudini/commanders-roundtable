// `Spyglass Siren` — the entry pays a Map.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPYGLASS_SIREN_SCRIPT } from './spyglassSiren';
import { advanceUntil, holdEverywhere, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spied(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Spyglass Siren'], []],
    scripts: createRegistry([SPYGLASS_SIREN_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Spyglass Siren');
  settle(g);
  return g;
}

describe('Spyglass Siren', () => {
  test('the entry creates one Map token', () => {
    const g = spied();
    const tokens = (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken);
    expect(tokens).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = spied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
