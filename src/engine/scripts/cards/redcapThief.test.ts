// `Redcap Thief` — the entry pockets a Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REDCAP_THIEF_SCRIPT } from './redcapThief';
import { advanceUntil, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thieved(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Redcap Thief'], []],
    scripts: createRegistry([REDCAP_THIEF_SCRIPT]),
  });
  put(g, 'p1', 'Redcap Thief');
  settle(g);
  return g;
}

describe('Redcap Thief', () => {
  test('entering mints a Treasure', () => {
    const g = thieved();
    const treasures = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Treasure');
    expect(treasures).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = thieved();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
