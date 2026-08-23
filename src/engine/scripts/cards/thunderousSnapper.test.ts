// `Thunderous Snapper` — the mana-value cast filter, proven from both sides
// in one game so the two casts share a board.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THUNDEROUS_SNAPPER_SCRIPT } from './thunderousSnapper';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SNAPPER = 'Thunderous Snapper';
const BIG = 'Grave Titan'; // {4}{B}{B} — mana value 6
const SMALL = 'Grizzly Bears'; // {1}{G} — mana value 2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

/** Casts `name` from p1's hand and reports the draws it caused. */
function cast(g: Game, name: string): number {
  const spell = put(g, 'p1', name, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 6 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return drawn(g, since);
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SNAPPER, BIG, SMALL], []],
    scripts: createRegistry([THUNDEROUS_SNAPPER_SCRIPT]),
  });
  put(g, 'p1', SNAPPER);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

describe('Thunderous Snapper', () => {
  test('a mana value 6 spell draws; a mana value 2 spell does not', () => {
    const g = game();
    expect(cast(g, BIG)).toBe(1);
    expect(cast(g, SMALL)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = game();
    cast(g, BIG);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
