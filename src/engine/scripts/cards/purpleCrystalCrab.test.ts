// `Purple-Crystal Crab` — dying pays a card, counted in log moves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PURPLE_CRYSTAL_CRAB_SCRIPT } from './purpleCrystalCrab';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Purple-Crystal Crab', () => {
  test('dying draws exactly one', () => {
    const g = startedGame({
      players: 2,
      decks: [['Purple-Crystal Crab'], []],
      scripts: createRegistry([PURPLE_CRYSTAL_CRAB_SCRIPT]),
    });
    const crab = put(g, 'p1', 'Purple-Crystal Crab');
    settle(g);
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: crab, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    const drew = g.log
      .slice(logAt)
      .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
      .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').length;
    expect(drew).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Purple-Crystal Crab'], []],
      scripts: createRegistry([PURPLE_CRYSTAL_CRAB_SCRIPT]),
    });
    const crab = put(g, 'p1', 'Purple-Crystal Crab');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: crab, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
