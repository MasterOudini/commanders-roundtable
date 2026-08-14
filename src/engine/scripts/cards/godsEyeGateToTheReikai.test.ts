// `Gods' Eye, Gate to the Reikai` — the LAND that pays a Spirit when it
// dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GODS_EYE_GATE_TO_THE_REIKAI_SCRIPT } from './godsEyeGateToTheReikai';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GODS_EYE = "Gods' Eye, Gate to the Reikai";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spirits(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Spirit').length;
}

describe("Gods' Eye, Gate to the Reikai", () => {
  test('dying creates the 1/1 Spirit', () => {
    const g = startedGame({
      players: 2,
      decks: [[GODS_EYE], []],
      scripts: createRegistry([GODS_EYE_GATE_TO_THE_REIKAI_SCRIPT]),
    });
    const eye = put(g, 'p1', GODS_EYE);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: eye, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(spirits(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[GODS_EYE], []],
      scripts: createRegistry([GODS_EYE_GATE_TO_THE_REIKAI_SCRIPT]),
    });
    const eye = put(g, 'p1', GODS_EYE);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: eye, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
