// `Vial Smasher, Gleeful Grenadier` — an OUTLAW is a subtype SET, so a Pirate
// fires it and a plain Bear does not; and "another" spares its own entry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VIAL_SMASHER_GLEEFUL_GRENADIER_SCRIPT } from './vialSmasherGleefulGrenadier';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SMASHER = 'Vial Smasher, Gleeful Grenadier';
const OUTLAW = 'Brazen Freebooter'; // Human PIRATE
const PLAIN = 'Grizzly Bears'; // Bear — no outlaw subtype

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SMASHER, OUTLAW, PLAIN], []],
    scripts: createRegistry([VIAL_SMASHER_GLEEFUL_GRENADIER_SCRIPT]),
  });
  put(g, 'p1', SMASHER);
  settle(g);
  return g;
}

describe('Vial Smasher, Gleeful Grenadier', () => {
  test('its OWN entry pays nothing — the line says "another"', () => {
    const g = board();
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('a Pirate entering deals 1 to the chosen opponent', () => {
    const g = board();
    put(g, 'p1', OUTLAW);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('a Bear is not an outlaw and pays nothing', () => {
    const g = board();
    put(g, 'p1', PLAIN);
    settle(g);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = board();
    put(g, 'p1', OUTLAW);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
