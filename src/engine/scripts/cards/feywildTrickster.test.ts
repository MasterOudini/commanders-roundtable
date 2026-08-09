// `Feywild Trickster` — MY roll pays a Faerie Dragon; an opponent's roll
// pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FEYWILD_TRICKSTER_SCRIPT } from './feywildTrickster';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TRICKSTER = 'Feywild Trickster';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dragons(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Faerie Dragon').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[TRICKSTER], []],
    scripts: createRegistry([FEYWILD_TRICKSTER_SCRIPT]),
  });
  put(g, 'p1', TRICKSTER);
  settle(g);
  return g;
}

describe('Feywild Trickster', () => {
  test('rolling a die creates the Faerie Dragon', () => {
    const g = board();
    must(g.submit({ t: 'RollDice', player: 'p1', sides: 20 }));
    settle(g);
    expect(dragons(g)).toBe(1);
  });

  test("an OPPONENT's roll pays nothing", () => {
    const g = board();
    must(g.submit({ t: 'RollDice', player: 'p2', sides: 6 }));
    settle(g);
    expect(dragons(g)).toBe(0);
  });

  test('replays to the same hash — the roll itself is on the log', () => {
    const g = board();
    must(g.submit({ t: 'RollDice', player: 'p1', sides: 20 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
