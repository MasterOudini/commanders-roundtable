// `S.H.I.E.L.D. Deployment Drone` — entering deploys one Soldier.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHIELD_DEPLOYMENT_DRONE_SCRIPT } from './shieldDeploymentDrone';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function droned(): Game {
  const g = startedGame({
    players: 2,
    decks: [['S.H.I.E.L.D. Deployment Drone'], []],
    scripts: createRegistry([SHIELD_DEPLOYMENT_DRONE_SCRIPT]),
  });
  put(g, 'p1', 'S.H.I.E.L.D. Deployment Drone');
  settle(g);
  return g;
}

describe('S.H.I.E.L.D. Deployment Drone', () => {
  test('entering deploys one Soldier token', () => {
    const g = droned();
    expect(tokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = droned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
