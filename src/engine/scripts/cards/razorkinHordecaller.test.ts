// `Razorkin Hordecaller` — attacking mints a Gremlin; a turn without an
// attack mints nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAZORKIN_HORDECALLER_SCRIPT } from './razorkinHordecaller';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function called(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Razorkin Hordecaller'], []],
    scripts: createRegistry([RAZORKIN_HORDECALLER_SCRIPT]),
  });
  const caller = put(g, 'p1', 'Razorkin Hordecaller');
  settle(g);
  holdEverywhere(g);
  // Turn 3 — the Hordecaller is summoning-sick the turn it lands.
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: caller, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  settle(g);
  return g;
}

describe('Razorkin Hordecaller', () => {
  test('the attack mints one Gremlin', () => {
    const g = called();
    const gremlins = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Gremlin');
    expect(gremlins).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = called();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
