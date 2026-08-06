// `Drogskol Reaver` — a gain draws; a loss and an OPPONENT's gain do not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DROGSKOL_REAVER_SCRIPT } from './drogskolReaver';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const REAVER = 'Drogskol Reaver';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log.slice(from).reduce(
    (n, e) =>
      e.body.t === 'CardsMoved'
        ? n +
          e.body.moves.filter(
            (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
          ).length
        : n,
    0,
  );
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[REAVER], []],
    scripts: createRegistry([DROGSKOL_REAVER_SCRIPT]),
  });
  put(g, 'p1', REAVER);
  settle(g);
  return g;
}

describe('Drogskol Reaver', () => {
  test('gaining life draws a card', () => {
    const g = board();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 5 }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('LOSING life draws nothing — the filter is the delta sign', () => {
    const g = board();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -5 }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test("an OPPONENT's gain is not yours", () => {
    const g = board();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: 5 }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 3 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
