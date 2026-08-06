// `Dazzling Angel` — my creature pays 1 life, an opponent's pays nothing,
// and a TOKEN of mine counts (the two-def rule).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DAZZLING_ANGEL_SCRIPT } from './dazzlingAngel';
import { SOLDIER_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ANGEL = 'Dazzling Angel';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[ANGEL, BEARS], [BEARS]],
    scripts: createRegistry([DAZZLING_ANGEL_SCRIPT]),
  });
  put(g, 'p1', ANGEL);
  settle(g);
  return g;
}

describe('Dazzling Angel', () => {
  test('my creature pays 1, an opponent creature pays nothing, my token pays 1', () => {
    const g = game();
    const base = g.state.players['p1']?.life ?? 0;
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(base + 1);
    put(g, 'p2', BEARS);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(base + 1);
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(base + 2);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', BEARS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
