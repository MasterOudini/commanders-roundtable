// `Buzz Bots` — dying draws a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BUZZ_BOTS_SCRIPT } from './buzzBots';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BOTS = 'Buzz Bots';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
        ),
    ).length;
}

describe('Buzz Bots', () => {
  test('dying draws its controller a card', () => {
    const g = startedGame({
      players: 2,
      decks: [[BOTS], []],
      scripts: createRegistry([BUZZ_BOTS_SCRIPT]),
    });
    const bots = put(g, 'p1', BOTS);
    settle(g);
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: bots, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[BOTS], []],
      scripts: createRegistry([BUZZ_BOTS_SCRIPT]),
    });
    const bots = put(g, 'p1', BOTS);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: bots, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
