// `Dunes of the Dead` — a LAND that pays a Zombie on the way out.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DUNES_OF_THE_DEAD_SCRIPT } from './dunesOfTheDead';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const DUNES = 'Dunes of the Dead';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Dunes of the Dead', () => {
  test('the land dying creates the 2/2 Zombie', () => {
    const g = startedGame({
      players: 2,
      decks: [[DUNES], []],
      scripts: createRegistry([DUNES_OF_THE_DEAD_SCRIPT]),
    });
    const dunes = put(g, 'p1', DUNES);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: dunes, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Zombie')).toHaveLength(1);
  });

  test('bouncing it to HAND pays nothing — the wording is graveyard-only', () => {
    const g = startedGame({
      players: 2,
      decks: [[DUNES], []],
      scripts: createRegistry([DUNES_OF_THE_DEAD_SCRIPT]),
    });
    const dunes = put(g, 'p1', DUNES);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: dunes, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Zombie')).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[DUNES], []],
      scripts: createRegistry([DUNES_OF_THE_DEAD_SCRIPT]),
    });
    const dunes = put(g, 'p1', DUNES);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: dunes, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
