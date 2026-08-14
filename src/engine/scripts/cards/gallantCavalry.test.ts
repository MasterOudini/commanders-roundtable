// `Gallant Cavalry` — the ETB Knight, on the vigilance printing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GALLANT_CAVALRY_SCRIPT } from './gallantCavalry';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CAVALRY = 'Gallant Cavalry';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function knights(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Knight').length;
}

describe('Gallant Cavalry', () => {
  test('entering creates a 2/2 Knight with vigilance', () => {
    const g = startedGame({
      players: 2,
      decks: [[CAVALRY], []],
      scripts: createRegistry([GALLANT_CAVALRY_SCRIPT]),
    });
    put(g, 'p1', CAVALRY);
    settle(g);
    expect(knights(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CAVALRY], []],
      scripts: createRegistry([GALLANT_CAVALRY_SCRIPT]),
    });
    put(g, 'p1', CAVALRY);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
