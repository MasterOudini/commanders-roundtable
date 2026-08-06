// `Emrakul's Influence` — a big Eldrazi cast draws two; a small non-Eldrazi
// cast draws nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EMRAKULS_INFLUENCE_SCRIPT } from './emrakulsInfluence';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const INFLUENCE = "Emrakul's Influence";
const ELDRAZI = 'Desolation Twin';
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
    decks: [[INFLUENCE, ELDRAZI, BEARS], []],
    scripts: createRegistry([EMRAKULS_INFLUENCE_SCRIPT]),
  });
  put(g, 'p1', INFLUENCE);
  settle(g);
  return g;
}

describe("Emrakul's Influence", () => {
  test('casting a mana-value-10 Eldrazi creature draws TWO', () => {
    const g = board();
    const twin = put(g, 'p1', ELDRAZI, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 10 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: twin }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
  });

  test('a small non-Eldrazi cast pays nothing', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const twin = put(g, 'p1', ELDRAZI, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 10 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: twin }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
