// `Contemplation` — "Whenever YOU cast a spell": the controller's cast pays,
// an opponent's does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CONTEMPLATION_SCRIPT } from './contemplation';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CONTEMPLATION = 'Contemplation';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[CONTEMPLATION, BEARS], [BEARS]],
    scripts: createRegistry([CONTEMPLATION_SCRIPT]),
  });
  put(g, 'p1', CONTEMPLATION);
  settle(g);
  return g;
}

describe('Contemplation', () => {
  test('your own cast gains 1; the resolution changes nothing more', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 1);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test("an OPPONENT's cast pays nothing", () => {
    const g = game();
    const theirs = put(g, 'p2', BEARS, 'hand');
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.priority.player === 'p2' && s.priority.awaiting === null,
      20_000,
    );
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: theirs }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore);
  });

  test('replays to the same hash', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
