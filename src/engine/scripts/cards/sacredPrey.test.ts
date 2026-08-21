// `Sacred Prey` — being blocked pays 1, through a real declaration from
// the defender's seat.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SACRED_PREY_SCRIPT } from './sacredPrey';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blocked(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Sacred Prey'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([SACRED_PREY_SCRIPT]),
  });
  const prey = put(g, 'p1', 'Sacred Prey');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: prey, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 60_000);
  must(
    g.submit({
      t: 'DeclareBlockers',
      player: 'p2',
      blocks: [{ blocker: bears, attacker: prey }],
    }),
  );
  settle(g);
  return g;
}

describe('Sacred Prey', () => {
  test('being blocked pays 1 life', () => {
    const g = blocked();
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = blocked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
