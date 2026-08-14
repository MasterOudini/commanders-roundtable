// `Generous Stray` — Gallant Citizen's exact text on its own oracle id: the
// ETB draw, proven on THIS card (the Benalish rule — a twin is proven on its
// own id, never assumed from its sibling).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GENEROUS_STRAY_SCRIPT } from './generousStray';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const STRAY = 'Generous Stray';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Generous Stray', () => {
  test('entering draws its controller a card', () => {
    const g = startedGame({
      players: 2,
      decks: [[STRAY], []],
      scripts: createRegistry([GENEROUS_STRAY_SCRIPT]),
    });
    const id = put(g, 'p1', STRAY, 'graveyard');
    settle(g);
    const before = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }),
    );
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[STRAY], []],
      scripts: createRegistry([GENEROUS_STRAY_SCRIPT]),
    });
    put(g, 'p1', STRAY);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
