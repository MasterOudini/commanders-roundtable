// `Dawnhart Rejuvenator` — the ETB gain beside an engine-owned mana line.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DAWNHART_REJUVENATOR_SCRIPT } from './dawnhartRejuvenator';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const REJUVENATOR = 'Dawnhart Rejuvenator';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[REJUVENATOR], []],
    scripts: createRegistry([DAWNHART_REJUVENATOR_SCRIPT]),
  });
}

describe('Dawnhart Rejuvenator', () => {
  test('entering gains 3', () => {
    const g = game();
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    put(g, 'p1', REJUVENATOR);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 3);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', REJUVENATOR);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
