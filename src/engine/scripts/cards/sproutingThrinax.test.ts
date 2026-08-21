// `Sprouting Thrinax` — the death pays three DISTINCT Saprolings.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPROUTING_THRINAX_SCRIPT } from './sproutingThrinax';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sprouted(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sprouting Thrinax'], []],
    scripts: createRegistry([SPROUTING_THRINAX_SCRIPT]),
  });
  const thrinax = put(g, 'p1', 'Sprouting Thrinax');
  settle(g);
  holdEverywhere(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: thrinax,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Sprouting Thrinax', () => {
  test('three distinct Saprolings arrive', () => {
    const g = sprouted();
    const tokens = (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken);
    expect(tokens).toHaveLength(3);
    expect(new Set(tokens).size).toBe(3);
  });

  test('replays to the same hash', () => {
    const g = sprouted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
