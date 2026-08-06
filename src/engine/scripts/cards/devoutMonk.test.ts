// `Devout Monk` — entering gains 1 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEVOUT_MONK_SCRIPT } from './devoutMonk';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MONK = 'Devout Monk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Devout Monk', () => {
  test('entering gains 1 life', () => {
    const g = startedGame({
      players: 2,
      decks: [[MONK], []],
      scripts: createRegistry([DEVOUT_MONK_SCRIPT]),
    });
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    put(g, 'p1', MONK);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 1);
  });

  test('a dying Monk pays nothing more — the trigger is the entry', () => {
    const g = startedGame({
      players: 2,
      decks: [[MONK], []],
      scripts: createRegistry([DEVOUT_MONK_SCRIPT]),
    });
    const monk = put(g, 'p1', MONK);
    settle(g);
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: monk, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[MONK], []],
      scripts: createRegistry([DEVOUT_MONK_SCRIPT]),
    });
    put(g, 'p1', MONK);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
