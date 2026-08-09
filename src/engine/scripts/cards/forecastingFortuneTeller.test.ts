// `Forecasting Fortune Teller` — entering brings the Clue.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FORECASTING_FORTUNE_TELLER_SCRIPT } from './forecastingFortuneTeller';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TELLER = 'Forecasting Fortune Teller';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Forecasting Fortune Teller', () => {
  test('entering creates a Clue token', () => {
    const g = startedGame({
      players: 2,
      decks: [[TELLER], []],
      scripts: createRegistry([FORECASTING_FORTUNE_TELLER_SCRIPT]),
    });
    put(g, 'p1', TELLER);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Clue')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[TELLER], []],
      scripts: createRegistry([FORECASTING_FORTUNE_TELLER_SCRIPT]),
    });
    put(g, 'p1', TELLER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
