// `Third Path Iconoclast` — a Soldier per NONCREATURE cast; a creature cast
// pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THIRD_PATH_ICONOCLAST_SCRIPT } from './thirdPathIconoclast';
import { advanceUntil, battlefieldOf, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ICONOCLAST = 'Third Path Iconoclast';
const NONCREATURE = 'Sol Ring';
const CREATURE = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiers(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Soldier').length;
}

function cast(name: string): Game {
  const g = startedGame({
    players: 2,
    decks: [[ICONOCLAST, NONCREATURE, CREATURE], []],
    scripts: createRegistry([THIRD_PATH_ICONOCLAST_SCRIPT]),
  });
  put(g, 'p1', ICONOCLAST);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', name, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Third Path Iconoclast', () => {
  test('a NONCREATURE cast makes a Soldier', () => {
    expect(soldiers(cast(NONCREATURE))).toBe(1);
  });

  test('a CREATURE cast makes nothing', () => {
    expect(soldiers(cast(CREATURE))).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = cast(NONCREATURE);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
