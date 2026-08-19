// `Martyr of Dusk` — dying pays a 1/1 lifelink Vampire.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MARTYR_OF_DUSK_SCRIPT } from './martyrOfDusk';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MARTYR = 'Martyr of Dusk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function vampires(g: Game): number {
  return battlefieldOf(g, 'p1').filter(
    (id) => nameOf(g, id) === 'Vampire' && g.state.cards[id]?.isToken,
  ).length;
}

describe('Martyr of Dusk', () => {
  test('dying pays a Vampire token', () => {
    const g = startedGame({
      players: 2,
      decks: [[MARTYR], []],
      scripts: createRegistry([MARTYR_OF_DUSK_SCRIPT]),
    });
    const martyr = put(g, 'p1', MARTYR);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: martyr,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(vampires(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[MARTYR], []],
      scripts: createRegistry([MARTYR_OF_DUSK_SCRIPT]),
    });
    const martyr = put(g, 'p1', MARTYR);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: martyr,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
