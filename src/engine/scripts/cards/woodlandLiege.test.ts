// `Woodland Liege` — a Beast of MINE entering draws; a non-Beast does not;
// an opponent's Beast does not.
//
// ⚠️ The positive case is staged through the GRAVEYARD and measured BEFORE
// the entry (Wall of Omens' shape): `put` straight onto the battlefield
// resolves the trigger inside its own pump, and a baseline read after it has
// already absorbed the draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WOODLAND_LIEGE_SCRIPT } from './woodlandLiege';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const LIEGE = 'Woodland Liege';
const BEAST = 'Aquus Steed';
const NOT_A_BEAST = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [LIEGE, BEAST, NOT_A_BEAST],
      [BEAST],
    ],
    scripts: createRegistry([WOODLAND_LIEGE_SCRIPT]),
  });
  put(g, 'p1', LIEGE);
  settle(g);
  return g;
}

/** Stage a card in `player`'s graveyard, measure MY hand, then bring it in. */
function enterFromGraveyard(g: Game, player: 'p1' | 'p2', name: string): number {
  const id = put(g, player, name, 'graveyard');
  settle(g);
  const before = idsIn(g, 'p1', 'hand').length;
  must(g.submit({ t: 'ManualMoveCard', player, card: id, to: { kind: 'battlefield', player } }));
  settle(g);
  return idsIn(g, 'p1', 'hand').length - before;
}

describe('Woodland Liege', () => {
  test('a Beast of mine entering draws a card', () => {
    expect(enterFromGraveyard(board(), 'p1', BEAST)).toBe(1);
  });

  test('a non-Beast of mine draws nothing', () => {
    expect(enterFromGraveyard(board(), 'p1', NOT_A_BEAST)).toBe(0);
  });

  test("an OPPONENT's Beast draws me nothing", () => {
    expect(enterFromGraveyard(board(), 'p2', BEAST)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    enterFromGraveyard(g, 'p1', BEAST);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
