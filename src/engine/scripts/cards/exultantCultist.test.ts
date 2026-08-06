// `Exultant Cultist` — dying draws a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EXULTANT_CULTIST_SCRIPT } from './exultantCultist';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CULTIST = 'Exultant Cultist';

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

describe('Exultant Cultist', () => {
  test('dying draws a card', () => {
    const g = startedGame({
      players: 2,
      decks: [[CULTIST], []],
      scripts: createRegistry([EXULTANT_CULTIST_SCRIPT]),
    });
    const cultist = put(g, 'p1', CULTIST);
    settle(g);
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: cultist, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CULTIST], []],
      scripts: createRegistry([EXULTANT_CULTIST_SCRIPT]),
    });
    const cultist = put(g, 'p1', CULTIST);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: cultist, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
