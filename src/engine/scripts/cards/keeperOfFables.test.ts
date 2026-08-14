// `Keeper of Fables` — a non-Human of mine (the Keeper itself, a Cat)
// connecting draws; a HUMAN connecting pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KEEPER_OF_FABLES_SCRIPT } from './keeperOfFables';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const KEEPER = 'Keeper of Fables';
const INFANTRY = 'Heavy Infantry';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Keeper of Fables', () => {
  test('a non-Human connecting with a player draws a card', () => {
    const g = startedGame({
      players: 2,
      decks: [[KEEPER], []],
      scripts: createRegistry([KEEPER_OF_FABLES_SCRIPT]),
    });
    const keeper = put(g, 'p1', KEEPER);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    const before = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: keeper, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('a HUMAN connecting pays nothing — the non-Human filter holds', () => {
    const g = startedGame({
      players: 2,
      decks: [[KEEPER, INFANTRY], []],
      scripts: createRegistry([KEEPER_OF_FABLES_SCRIPT]),
    });
    put(g, 'p1', KEEPER);
    const infantry = put(g, 'p1', INFANTRY);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    const before = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: infantry, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[KEEPER], []],
      scripts: createRegistry([KEEPER_OF_FABLES_SCRIPT]),
    });
    const keeper = put(g, 'p1', KEEPER);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: keeper, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
