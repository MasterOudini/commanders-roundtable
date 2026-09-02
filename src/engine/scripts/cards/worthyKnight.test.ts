// `Worthy Knight` — casting a KNIGHT spell makes a Human; casting a non-Knight
// does not; an opponent's Knight cast does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WORTHY_KNIGHT_SCRIPT } from './worthyKnight';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WORTHY = 'Worthy Knight';
const KNIGHT = 'White Knight'; // {W}{W}
const NOT_A_KNIGHT = 'Grizzly Bears'; // {1}{G}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function humans(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Human').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [WORTHY, KNIGHT, NOT_A_KNIGHT],
      [KNIGHT],
    ],
    scripts: createRegistry([WORTHY_KNIGHT_SCRIPT]),
  });
  put(g, 'p1', WORTHY);
  settle(g);
  return g;
}

describe('Worthy Knight', () => {
  test('casting a Knight makes exactly one Human', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    const knight = put(g, 'p1', KNIGHT, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: knight }));
    settle(g);
    expect(humans(g)).toBe(1);
  });

  test('casting a non-Knight makes nothing', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const bears = put(g, 'p1', NOT_A_KNIGHT, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(humans(g)).toBe(0);
  });

  test("an OPPONENT's Knight cast makes me nothing", () => {
    const g = board();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 2 }));
    const knight = put(g, 'p2', KNIGHT, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: knight }));
    settle(g);
    expect(humans(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    const knight = put(g, 'p1', KNIGHT, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: knight }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
