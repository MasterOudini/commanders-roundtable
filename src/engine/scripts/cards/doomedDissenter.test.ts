// `Doomed Dissenter` — dying leaves a 2/2 Zombie behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DOOMED_DISSENTER_SCRIPT } from './doomedDissenter';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const DISSENTER = 'Doomed Dissenter';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Doomed Dissenter', () => {
  test('dying creates the 2/2 Zombie', () => {
    const g = startedGame({
      players: 2,
      decks: [[DISSENTER], []],
      scripts: createRegistry([DOOMED_DISSENTER_SCRIPT]),
    });
    const dissenter = put(g, 'p1', DISSENTER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: dissenter, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Zombie')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[DISSENTER], []],
      scripts: createRegistry([DOOMED_DISSENTER_SCRIPT]),
    });
    const dissenter = put(g, 'p1', DISSENTER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: dissenter, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
