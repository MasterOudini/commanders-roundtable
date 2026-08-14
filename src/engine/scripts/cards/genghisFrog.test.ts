// `Genghis Frog` — self-inclusive: its OWN entry pays a Mutagen (and the
// Mutagen — an Artifact, not a Mutant — does not feed the trigger); another
// MUTANT pays; a plain creature and an opponent's Mutant do not.
//
// ⚠️ The TokenCreated arm's POSITIVE is unreachable here — no shipped script
// creates a Mutant TOKEN — so this file proves that arm's negative (the
// Mutagen itself) and the CardsMoved arm from both sides.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GENGHIS_FROG_SCRIPT } from './genghisFrog';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const FROG = 'Genghis Frog';
const MUTANT = 'Crustacean Commando';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mutagens(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Mutagen').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[FROG, MUTANT, BEARS], [MUTANT]],
    scripts: createRegistry([GENGHIS_FROG_SCRIPT]),
  });
  put(g, 'p1', FROG);
  settle(g);
  return g;
}

describe('Genghis Frog', () => {
  test('its own entry pays ONE Mutagen — the artifact token does not feed the trigger', () => {
    const g = board();
    expect(mutagens(g)).toBe(1);
  });

  test('another Mutant I control pays; a plain creature does not', () => {
    const g = board();
    put(g, 'p1', MUTANT);
    settle(g);
    expect(mutagens(g)).toBe(2);
    put(g, 'p1', BEARS);
    settle(g);
    expect(mutagens(g)).toBe(2);
  });

  test("an OPPONENT's Mutant pays nothing", () => {
    const g = board();
    put(g, 'p2', MUTANT);
    settle(g);
    expect(mutagens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = board();
    put(g, 'p1', MUTANT);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
