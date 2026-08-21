// `Protector of Gondor` — the entry raises a Human Soldier.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PROTECTOR_OF_GONDOR_SCRIPT } from './protectorOfGondor';
import { advanceUntil, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function protected_(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Protector of Gondor'], []],
    scripts: createRegistry([PROTECTOR_OF_GONDOR_SCRIPT]),
  });
  put(g, 'p1', 'Protector of Gondor');
  settle(g);
  return g;
}

describe('Protector of Gondor', () => {
  test('entering mints a 1/1 white Human Soldier', () => {
    const g = protected_();
    const soldiers = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Human Soldier');
    expect(soldiers).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = protected_();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
