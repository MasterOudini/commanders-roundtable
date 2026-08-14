// `Maalfeld Twins` — dying leaves two distinct Zombies behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MAALFELD_TWINS_SCRIPT } from './maalfeldTwins';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TWINS = 'Maalfeld Twins';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[TWINS], []],
    scripts: createRegistry([MAALFELD_TWINS_SCRIPT]),
  });
  const twins = put(g, 'p1', TWINS);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: twins,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Maalfeld Twins', () => {
  test('dying creates two Zombies with distinct ids', () => {
    const g = died();
    const zombies = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Zombie');
    expect(zombies).toHaveLength(2);
    expect(new Set(zombies).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
