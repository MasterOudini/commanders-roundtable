// `Dragonlair Spider` — an OPPONENT's cast pays an Insect to the Spider's
// controller; your own cast pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRAGONLAIR_SPIDER_SCRIPT } from './dragonlairSpider';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPIDER = 'Dragonlair Spider';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function insects(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Insect').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SPIDER, BEARS], [BEARS]],
    scripts: createRegistry([DRAGONLAIR_SPIDER_SCRIPT]),
  });
  put(g, 'p1', SPIDER);
  settle(g);
  return g;
}

describe('Dragonlair Spider', () => {
  test("an opponent's cast pays MY controller an Insect", () => {
    const g = board();
    const theirs = put(g, 'p2', BEARS, 'hand');
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.priority.player === 'p2' && s.priority.awaiting === null,
      20_000,
    );
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: theirs }));
    settle(g);
    expect(insects(g)).toBe(1);
  });

  test('your OWN cast pays nothing', () => {
    const g = board();
    const mine = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mine }));
    settle(g);
    expect(insects(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const mine = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mine }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
