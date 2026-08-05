// `Carven Caryatid` — the ETB draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CARVEN_CARYATID_SCRIPT } from './carvenCaryatid';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CARYATID = 'Carven Caryatid';

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

describe('Carven Caryatid', () => {
  test('entering draws its controller a card', () => {
    const g = startedGame({
      players: 2,
      decks: [[CARYATID], []],
      scripts: createRegistry([CARVEN_CARYATID_SCRIPT]),
    });
    const spirit = put(g, 'p1', CARYATID, 'graveyard');
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: spirit, to: { kind: 'battlefield', player: 'p1' } }),
    );
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CARYATID], []],
      scripts: createRegistry([CARVEN_CARYATID_SCRIPT]),
    });
    put(g, 'p1', CARYATID);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
