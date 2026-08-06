// `Femeref Enchantress` — ANY dying enchantment pays; a dying creature
// does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FEMEREF_ENCHANTRESS_SCRIPT } from './femerefEnchantress';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ENCHANTRESS = 'Femeref Enchantress';
const ENCHANTMENT = 'Contemplation';
const BEARS = 'Grizzly Bears';

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
    decks: [[ENCHANTRESS, BEARS], [ENCHANTMENT]],
    scripts: createRegistry([FEMEREF_ENCHANTRESS_SCRIPT]),
  });
  put(g, 'p1', ENCHANTRESS);
  settle(g);
  return g;
}

describe('Femeref Enchantress', () => {
  test("an OPPONENT's enchantment dying draws — the wording is any", () => {
    const g = board();
    const theirs = put(g, 'p2', ENCHANTMENT);
    settle(g);
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'graveyard', player: 'p2' } }),
    );
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('a dying CREATURE pays nothing', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const theirs = put(g, 'p2', ENCHANTMENT);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'graveyard', player: 'p2' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
