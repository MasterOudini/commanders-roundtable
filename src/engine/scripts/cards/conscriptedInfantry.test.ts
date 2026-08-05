// `Conscripted Infantry` — dying leaves the artifact Soldier behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CONSCRIPTED_INFANTRY_SCRIPT } from './conscriptedInfantry';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const INFANTRY = 'Conscripted Infantry';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Conscripted Infantry', () => {
  test('dying creates a real 1/1 Soldier token', () => {
    const g = startedGame({
      players: 2,
      decks: [[INFANTRY], []],
      scripts: createRegistry([CONSCRIPTED_INFANTRY_SCRIPT]),
    });
    const infantry = put(g, 'p1', INFANTRY);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: infantry,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Soldier')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[INFANTRY], []],
      scripts: createRegistry([CONSCRIPTED_INFANTRY_SCRIPT]),
    });
    const infantry = put(g, 'p1', INFANTRY);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: infantry,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
