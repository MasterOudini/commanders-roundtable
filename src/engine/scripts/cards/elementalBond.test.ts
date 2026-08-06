// `Elemental Bond` — power 3 draws, power 2 does not, and a TOKEN counts
// through the second def.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELEMENTAL_BOND_SCRIPT } from './elementalBond';
import { DRAGON_5_5_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BOND = 'Elemental Bond';
const BIG = 'Krenko, Mob Boss';
const SMALL = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log.slice(from).reduce(
    (n, e) =>
      e.body.t === 'CardsMoved'
        ? n +
          e.body.moves.filter(
            (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
          ).length
        : n,
    0,
  );
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[BOND, BIG, SMALL], []],
    scripts: createRegistry([ELEMENTAL_BOND_SCRIPT]),
  });
  put(g, 'p1', BOND);
  settle(g);
  return g;
}

describe('Elemental Bond', () => {
  test('a power-3 creature entering draws; a power-2 one does not', () => {
    const g = board();
    let logAt = g.log.length;
    put(g, 'p1', BIG);
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    logAt = g.log.length;
    put(g, 'p1', SMALL);
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('a TOKEN with power 3 or greater counts — the second def', () => {
    const g = board();
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: DRAGON_5_5_TOKEN.scryfallId, count: 1 }),
    );
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = board();
    put(g, 'p1', BIG);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
