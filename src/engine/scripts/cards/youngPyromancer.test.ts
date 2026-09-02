// `Young Pyromancer` — an instant makes an Elemental; a creature spell does
// not; an opponent's instant does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { YOUNG_PYROMANCER_SCRIPT } from './youngPyromancer';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PYRO = 'Young Pyromancer';
const INSTANT = 'Vitalize'; // {G}
const CREATURE = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function elementals(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Elemental').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [PYRO, INSTANT, CREATURE],
      [INSTANT],
    ],
    scripts: createRegistry([YOUNG_PYROMANCER_SCRIPT]),
  });
  put(g, 'p1', PYRO);
  settle(g);
  return g;
}

describe('Young Pyromancer', () => {
  test('casting an INSTANT makes one Elemental', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    const spell = put(g, 'p1', INSTANT, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    expect(elementals(g)).toBe(1);
  });

  test('casting a CREATURE makes nothing', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const spell = put(g, 'p1', CREATURE, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    expect(elementals(g)).toBe(0);
  });

  test("an OPPONENT's instant makes me nothing", () => {
    const g = board();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
    const spell = put(g, 'p2', INSTANT, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
    settle(g);
    expect(elementals(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    const spell = put(g, 'p1', INSTANT, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
