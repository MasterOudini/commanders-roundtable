// `Beskir Shieldmate` — dying leaves a 1/1 Human Warrior behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BESKIR_SHIELDMATE_SCRIPT } from './beskirShieldmate';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SHIELDMATE = 'Beskir Shieldmate';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Beskir Shieldmate', () => {
  test('dying creates a real 1/1 Human Warrior token', () => {
    const g = startedGame({
      players: 2,
      decks: [[SHIELDMATE], []],
      scripts: createRegistry([BESKIR_SHIELDMATE_SCRIPT]),
    });
    const mate = put(g, 'p1', SHIELDMATE);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: mate, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Human Warrior')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SHIELDMATE], []],
      scripts: createRegistry([BESKIR_SHIELDMATE_SCRIPT]),
    });
    const mate = put(g, 'p1', SHIELDMATE);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: mate, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
