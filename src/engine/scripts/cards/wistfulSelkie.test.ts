// `Wistful Selkie` — the entry draws exactly one.
//
// ⚠️ Staged through the GRAVEYARD and measured BEFORE the entry (Wall of
// Omens' shape): `put` straight onto the battlefield resolves the trigger
// inside its own pump, so a baseline read after it has already absorbed the
// draw and the assertion races its own measurement.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WISTFUL_SELKIE_SCRIPT } from './wistfulSelkie';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SELKIE = 'Wistful Selkie';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[SELKIE], []],
    scripts: createRegistry([WISTFUL_SELKIE_SCRIPT]),
  });
}

describe('Wistful Selkie', () => {
  test('the entry draws exactly one card', () => {
    const g = game();
    const id = put(g, 'p1', SELKIE, 'graveyard');
    settle(g);
    const before = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }),
    );
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', SELKIE);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
