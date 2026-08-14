// `Insight` — an OPPONENT'S green cast draws ME a card; my own green cast
// pays nothing (the opponent filter, proven from the controller's seat).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { INSIGHT_SCRIPT } from './insight';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const INSIGHT = 'Insight';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [INSIGHT, BEARS],
      [BEARS],
    ],
    scripts: createRegistry([INSIGHT_SCRIPT]),
  });
  put(g, 'p1', INSIGHT);
  settle(g);
  return g;
}

describe('Insight', () => {
  test("an opponent's green cast draws me a card", () => {
    const g = board();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    const bears = put(g, 'p2', BEARS, 'hand');
    const mine = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(mine + 1);
  });

  test('my OWN green cast pays nothing — the opponent filter holds', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const bears = put(g, 'p1', BEARS, 'hand');
    const mine = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    // −1 for the cast Bears, no draw: net one down.
    expect(idsIn(g, 'p1', 'hand').length).toBe(mine - 1);
  });

  test('replays to the same hash', () => {
    const g = board();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    const bears = put(g, 'p2', BEARS, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
