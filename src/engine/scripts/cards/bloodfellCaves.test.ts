// `Bloodfell Caves` — the gain and the built-in tap, both asserted.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLOODFELL_CAVES_SCRIPT } from './bloodfellCaves';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CAVES = 'Bloodfell Caves';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Bloodfell Caves', () => {
  test('entering gains 1 life AND comes in tapped', () => {
    const g = startedGame({
      players: 2,
      decks: [[CAVES], []],
      scripts: createRegistry([BLOODFELL_CAVES_SCRIPT]),
    });
    const caves = put(g, 'p1', CAVES, 'graveyard');
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: caves, to: { kind: 'battlefield', player: 'p1' } }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[caves]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CAVES], []],
      scripts: createRegistry([BLOODFELL_CAVES_SCRIPT]),
    });
    put(g, 'p1', CAVES);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
