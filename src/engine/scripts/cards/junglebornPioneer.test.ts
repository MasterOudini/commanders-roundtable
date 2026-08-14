// `Jungleborn Pioneer` — entering brings the hexproof Merfolk.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JUNGLEBORN_PIONEER_SCRIPT } from './junglebornPioneer';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PIONEER = 'Jungleborn Pioneer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[PIONEER], []],
    scripts: createRegistry([JUNGLEBORN_PIONEER_SCRIPT]),
  });
  put(g, 'p1', PIONEER);
  settle(g);
  return g;
}

describe('Jungleborn Pioneer', () => {
  test('entering creates the hexproof Merfolk', () => {
    const g = entered();
    const merfolk = battlefieldOf(g, 'p1').filter(
      (id) => nameOf(g, id) === 'Merfolk' && g.state.cards[id]?.isToken,
    );
    expect(merfolk).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
