// `Ambassador Oak` — a self-ETB token: the Elf Warrior must be REAL (named by
// the oracle), not a blank (D133).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AMBASSADOR_OAK_SCRIPT } from './ambassadorOak';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';

const OAK = 'Ambassador Oak';

describe('Ambassador Oak', () => {
  test('its entry brings a real 1/1 Elf Warrior, and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [[OAK], []],
      scripts: createRegistry([AMBASSADOR_OAK_SCRIPT]),
    });
    put(g, 'p1', OAK);
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Elf Warrior')).toHaveLength(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
