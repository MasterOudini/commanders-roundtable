// `Grasping Longneck` — dying pays 2 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRASPING_LONGNECK_SCRIPT } from './graspingLongneck';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const LONGNECK = 'Grasping Longneck';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[LONGNECK], []],
    scripts: createRegistry([GRASPING_LONGNECK_SCRIPT]),
  });
  const longneck = put(g, 'p1', LONGNECK);
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: longneck, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  return g;
}

describe('Grasping Longneck', () => {
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
