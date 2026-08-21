// `Resolute Reinforcements` — the entry brings a Soldier.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RESOLUTE_REINFORCEMENTS_SCRIPT } from './resoluteReinforcements';
import { advanceUntil, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reinforced(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Resolute Reinforcements'], []],
    scripts: createRegistry([RESOLUTE_REINFORCEMENTS_SCRIPT]),
  });
  put(g, 'p1', 'Resolute Reinforcements');
  settle(g);
  return g;
}

describe('Resolute Reinforcements', () => {
  test('entering mints a 1/1 white Soldier', () => {
    const g = reinforced();
    const soldiers = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Soldier');
    expect(soldiers).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = reinforced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
