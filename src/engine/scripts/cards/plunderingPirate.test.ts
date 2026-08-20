// `Plundering Pirate` — the entry pays a Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PLUNDERING_PIRATE_SCRIPT } from './plunderingPirate';
import { advanceUntil, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function plundered(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Plundering Pirate'], []],
    scripts: createRegistry([PLUNDERING_PIRATE_SCRIPT]),
  });
  put(g, 'p1', 'Plundering Pirate');
  settle(g);
  return g;
}

describe('Plundering Pirate', () => {
  test('entering mints a Treasure', () => {
    const g = plundered();
    const treasures = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Treasure');
    expect(treasures).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = plundered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
