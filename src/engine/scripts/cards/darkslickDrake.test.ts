// `Darkslick Drake` — the dies-draw, one card type over from Ashiok's Reaper.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DARKSLICK_DRAKE_SCRIPT } from './darkslickDrake';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DRAKE = 'Darkslick Drake';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawMoves(g: Game, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    for (const m of e.body.moves) {
      if (m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === 'p1') n++;
    }
  }
  return n;
}

function game(): { g: Game; drake: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DRAKE], []],
    scripts: createRegistry([DARKSLICK_DRAKE_SCRIPT]),
  });
  const drake = put(g, 'p1', DRAKE);
  settle(g);
  return { g, drake };
}

describe('Darkslick Drake', () => {
  test('dying draws a card', () => {
    const { g, drake } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: drake, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(drawMoves(g, logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, drake } = game();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: drake, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
