// `Precinct Captain` — connecting with a player mints a Soldier; a
// blocked swing mints nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRECINCT_CAPTAIN_SCRIPT } from './precinctCaptain';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiers(g: Game): number {
  return g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Soldier').length;
}

function charged(blocked: boolean): Game {
  const g = startedGame({
    players: 2,
    decks: [['Precinct Captain'], ['Colossal Dreadmaw']],
    scripts: createRegistry([PRECINCT_CAPTAIN_SCRIPT]),
  });
  const captain = put(g, 'p1', 'Precinct Captain');
  const wall = blocked ? put(g, 'p2', 'Colossal Dreadmaw') : null;
  settle(g);
  holdEverywhere(g);
  // Turn 3, not turn 1 — the Captain is summoning-sick the turn it lands.
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: captain, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  // A defender with no creatures is never asked to block — walking to a
  // declareBlockers prompt that cannot exist runs the game to its end.
  if (blocked && wall) {
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: wall, attacker: captain }] }));
  }
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain', 60_000);
  settle(g);
  return g;
}

describe('Precinct Captain', () => {
  test('combat damage to the player pays a 1/1 Soldier', () => {
    const g = charged(false);
    expect(soldiers(g)).toBe(1);
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('a blocked Captain pays nothing', () => {
    const g = charged(true);
    expect(soldiers(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = charged(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
