// `Hatching Plans` — dying is the point: the enchantment leaving the
// battlefield for a graveyard draws three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HATCHING_PLANS_SCRIPT } from './hatchingPlans';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PLANS = 'Hatching Plans';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[PLANS], []],
    scripts: createRegistry([HATCHING_PLANS_SCRIPT]),
  });
  const plans = put(g, 'p1', PLANS);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: plans,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Hatching Plans', () => {
  test('dying draws its controller three cards', () => {
    const g = startedGame({
      players: 2,
      decks: [[PLANS], []],
      scripts: createRegistry([HATCHING_PLANS_SCRIPT]),
    });
    const plans = put(g, 'p1', PLANS);
    settle(g);
    const before = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: plans,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 3);
  });

  test('replays to the same hash', () => {
    const g = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
