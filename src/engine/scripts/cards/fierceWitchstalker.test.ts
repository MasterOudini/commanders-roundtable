// `Fierce Witchstalker` — entering brings the Food.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FIERCE_WITCHSTALKER_SCRIPT } from './fierceWitchstalker';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WITCHSTALKER = 'Fierce Witchstalker';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Fierce Witchstalker', () => {
  test('entering creates a Food token', () => {
    const g = startedGame({
      players: 2,
      decks: [[WITCHSTALKER], []],
      scripts: createRegistry([FIERCE_WITCHSTALKER_SCRIPT]),
    });
    put(g, 'p1', WITCHSTALKER);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[WITCHSTALKER], []],
      scripts: createRegistry([FIERCE_WITCHSTALKER_SCRIPT]),
    });
    put(g, 'p1', WITCHSTALKER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
