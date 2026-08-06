// `Feral Prowler` — dying draws a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FERAL_PROWLER_SCRIPT } from './feralProwler';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PROWLER = 'Feral Prowler';

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

describe('Feral Prowler', () => {
  test('dying draws a card', () => {
    const g = startedGame({
      players: 2,
      decks: [[PROWLER], []],
      scripts: createRegistry([FERAL_PROWLER_SCRIPT]),
    });
    const prowler = put(g, 'p1', PROWLER);
    settle(g);
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: prowler, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[PROWLER], []],
      scripts: createRegistry([FERAL_PROWLER_SCRIPT]),
    });
    const prowler = put(g, 'p1', PROWLER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: prowler, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
