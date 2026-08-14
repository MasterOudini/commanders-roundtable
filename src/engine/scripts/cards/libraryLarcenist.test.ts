// `Library Larcenist` — a real declared attack draws a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LIBRARY_LARCENIST_SCRIPT } from './libraryLarcenist';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const LARCENIST = 'Library Larcenist';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [[LARCENIST], []],
    scripts: createRegistry([LIBRARY_LARCENIST_SCRIPT]),
  });
  const larcenist = put(g, 'p1', LARCENIST);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  const before = idsIn(g, 'p1', 'hand').length;
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: larcenist, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  settle(g);
  return { g, before };
}

describe('Library Larcenist', () => {
  test('attacking draws its controller a card', () => {
    const { g, before } = attacked();
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g } = attacked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
