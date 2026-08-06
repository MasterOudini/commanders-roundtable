// `Coral Barrier` — the ETB Squid, pinned to the ISLANDWALK printing: the
// ability is the identity (D131), and a nameless blank is the failure mode
// this assertion exists for (D133).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CORAL_BARRIER_SCRIPT } from './coralBarrier';
import { SQUID_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BARRIER = 'Coral Barrier';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[BARRIER], []],
    scripts: createRegistry([CORAL_BARRIER_SCRIPT]),
  });
}

describe('Coral Barrier', () => {
  test('entering creates the islandwalk Squid, by its exact printing', () => {
    const g = game();
    put(g, 'p1', BARRIER);
    settle(g);
    const tokens = Object.values(g.state.cards).filter((c) => c.isToken);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.printingId).toBe(SQUID_TOKEN.scryfallId);
    expect(tokens[0]?.controller).toBe('p1');
    expect(tokens[0]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', BARRIER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
