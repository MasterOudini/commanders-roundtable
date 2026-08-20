// `Piggy Bank` — the toy breaks open into a Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PIGGY_BANK_SCRIPT } from './piggyBank';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function broken(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Piggy Bank'], []],
    scripts: createRegistry([PIGGY_BANK_SCRIPT]),
  });
  const piggy = put(g, 'p1', 'Piggy Bank');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: piggy, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  return g;
}

describe('Piggy Bank', () => {
  test('dying mints a Treasure', () => {
    const g = broken();
    const treasures = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Treasure');
    expect(treasures).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = broken();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
