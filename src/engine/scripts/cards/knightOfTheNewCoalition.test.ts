// `Knight of the New Coalition` — entering brings the 2/2 vigilance Knight.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KNIGHT_OF_THE_NEW_COALITION_SCRIPT } from './knightOfTheNewCoalition';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const KNIGHT = 'Knight of the New Coalition';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[KNIGHT], []],
    scripts: createRegistry([KNIGHT_OF_THE_NEW_COALITION_SCRIPT]),
  });
  put(g, 'p1', KNIGHT);
  settle(g);
  return g;
}

describe('Knight of the New Coalition', () => {
  test('entering creates the 2/2 Knight token', () => {
    const g = entered();
    const knights = battlefieldOf(g, 'p1').filter(
      (id) => nameOf(g, id) === 'Knight' && g.state.cards[id]?.isToken,
    );
    expect(knights).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
