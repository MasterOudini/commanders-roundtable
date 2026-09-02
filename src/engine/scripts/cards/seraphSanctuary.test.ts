// `Seraph Sanctuary` — 1 life when the land enters, 1 more for an Angel of
// mine entering, nothing for a non-Angel.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SERAPH_SANCTUARY_SCRIPT } from './seraphSanctuary';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SANCTUARY = 'Seraph Sanctuary';
const ANGEL = 'Dazzling Angel'; // Creature — Angel
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function built(): { g: Game; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [[SANCTUARY, ANGEL, BEARS], []],
    scripts: createRegistry([SERAPH_SANCTUARY_SCRIPT]),
  });
  settle(g);
  const life0 = g.state.players['p1']?.life ?? 0;
  put(g, 'p1', SANCTUARY);
  settle(g);
  return { g, life0 };
}

describe('Seraph Sanctuary', () => {
  test('the land entering is 1 life', () => {
    const { g, life0 } = built();
    expect(g.state.players['p1']?.life).toBe(life0 + 1);
  });

  test('an Angel entering is 1 more; a non-Angel is nothing', () => {
    const { g, life0 } = built();
    put(g, 'p1', ANGEL);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(life0 + 2);
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(life0 + 2);
  });

  test('replays to the same hash', () => {
    const { g } = built();
    put(g, 'p1', ANGEL);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
