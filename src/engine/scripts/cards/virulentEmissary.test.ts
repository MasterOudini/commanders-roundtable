// `Virulent Emissary` — "another creature you control enters" pays 1 life,
// and its own entry pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VIRULENT_EMISSARY_SCRIPT } from './virulentEmissary';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const EMISSARY = 'Virulent Emissary';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring'; // not a creature

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[EMISSARY, BEARS, RING], [BEARS]],
    scripts: createRegistry([VIRULENT_EMISSARY_SCRIPT]),
  });
  put(g, 'p1', EMISSARY);
  settle(g);
  return g;
}

describe('Virulent Emissary', () => {
  test('its OWN entry pays nothing — the line says "another"', () => {
    const g = board();
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('another creature of mine entering gains me 1', () => {
    const g = board();
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test("an OPPONENT's creature gains me nothing", () => {
    const g = board();
    put(g, 'p2', BEARS);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('a non-creature of mine gains me nothing', () => {
    const g = board();
    put(g, 'p1', RING);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = board();
    put(g, 'p1', BEARS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
