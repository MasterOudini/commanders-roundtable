// `Herald of Faith` — a real declared attack pays 2 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HERALD_OF_FAITH_SCRIPT } from './heraldOfFaith';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HERALD = 'Herald of Faith';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): Game {
  const g = startedGame({
    players: 2,
    decks: [[HERALD], []],
    scripts: createRegistry([HERALD_OF_FAITH_SCRIPT]),
  });
  const herald = put(g, 'p1', HERALD);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: herald, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  settle(g);
  return g;
}

describe('Herald of Faith', () => {
  test('attacking gains its controller 2 life', () => {
    const g = attacked();
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = attacked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
