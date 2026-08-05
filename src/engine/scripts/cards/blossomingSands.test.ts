// `Blossoming Sands` — the gain and the built-in tap, both asserted.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLOSSOMING_SANDS_SCRIPT } from './blossomingSands';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SANDS = 'Blossoming Sands';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Blossoming Sands', () => {
  test('entering gains 1 life AND comes in tapped', () => {
    const g = startedGame({
      players: 2,
      decks: [[SANDS], []],
      scripts: createRegistry([BLOSSOMING_SANDS_SCRIPT]),
    });
    const sands = put(g, 'p1', SANDS, 'graveyard');
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: sands, to: { kind: 'battlefield', player: 'p1' } }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[sands]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SANDS], []],
      scripts: createRegistry([BLOSSOMING_SANDS_SCRIPT]),
    });
    put(g, 'p1', SANDS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
