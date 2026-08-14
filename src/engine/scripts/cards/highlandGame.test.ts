// `Highland Game` — dying pays 2 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HIGHLAND_GAME_SCRIPT } from './highlandGame';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GAME_ELK = 'Highland Game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[GAME_ELK], []],
    scripts: createRegistry([HIGHLAND_GAME_SCRIPT]),
  });
  const elk = put(g, 'p1', GAME_ELK);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: elk,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Highland Game', () => {
  test('dying gains its controller 2 life', () => {
    const g = died();
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
