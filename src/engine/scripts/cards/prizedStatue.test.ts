// `Prized Statue` — a Treasure on the way in, another on the way out.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRIZED_STATUE_SCRIPT } from './prizedStatue';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasures(g: Game): number {
  return g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Treasure').length;
}

describe('Prized Statue', () => {
  test('mints on entry and again on death', () => {
    const g = startedGame({
      players: 2,
      decks: [['Prized Statue'], []],
      scripts: createRegistry([PRIZED_STATUE_SCRIPT]),
    });
    const statue = put(g, 'p1', 'Prized Statue');
    settle(g);
    expect(treasures(g)).toBe(1);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: statue, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(treasures(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Prized Statue'], []],
      scripts: createRegistry([PRIZED_STATUE_SCRIPT]),
    });
    const statue = put(g, 'p1', 'Prized Statue');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: statue, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
