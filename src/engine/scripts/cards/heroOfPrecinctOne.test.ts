// `Hero of Precinct One` — a MULTICOLORED cast pays a Human; a mono-colour
// cast pays nothing. Baleful Strix ({U}{B}) is the two-colour spell the
// fixture pool already holds.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HERO_OF_PRECINCT_ONE_SCRIPT } from './heroOfPrecinctOne';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HERO = 'Hero of Precinct One';
const STRIX = 'Baleful Strix';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[HERO, STRIX, BEARS], []],
    scripts: createRegistry([HERO_OF_PRECINCT_ONE_SCRIPT]),
  });
  put(g, 'p1', HERO);
  settle(g);
  return g;
}

function humans(g: Game): number {
  return battlefieldOf(g, 'p1').filter(
    (id) => nameOf(g, id) === 'Human' && g.state.cards[id]?.isToken,
  ).length;
}

describe('Hero of Precinct One', () => {
  test('casting a multicolored spell makes a 1/1 Human', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    const strix = put(g, 'p1', STRIX, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: strix }));
    settle(g);
    expect(humans(g)).toBe(1);
  });

  test('a mono-colour cast pays nothing — the colour COUNT is the filter', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(humans(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    const strix = put(g, 'p1', STRIX, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: strix }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
