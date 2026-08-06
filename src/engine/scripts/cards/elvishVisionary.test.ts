// `Elvish Visionary` — entering draws a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELVISH_VISIONARY_SCRIPT } from './elvishVisionary';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const VISIONARY = 'Elvish Visionary';

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

describe('Elvish Visionary', () => {
  test('entering draws a card', () => {
    const g = startedGame({
      players: 2,
      decks: [[VISIONARY], []],
      scripts: createRegistry([ELVISH_VISIONARY_SCRIPT]),
    });
    const logAt = g.log.length;
    put(g, 'p1', VISIONARY);
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[VISIONARY], []],
      scripts: createRegistry([ELVISH_VISIONARY_SCRIPT]),
    });
    put(g, 'p1', VISIONARY);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
