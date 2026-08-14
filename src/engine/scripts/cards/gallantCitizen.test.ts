// `Gallant Citizen` — the ETB draw, staged through the graveyard so the hand
// arithmetic cannot race the entry (wallOfBlossoms.test's measured reason).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GALLANT_CITIZEN_SCRIPT } from './gallantCitizen';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CITIZEN = 'Gallant Citizen';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Gallant Citizen', () => {
  test('entering draws its controller a card', () => {
    const g = startedGame({
      players: 2,
      decks: [[CITIZEN], []],
      scripts: createRegistry([GALLANT_CITIZEN_SCRIPT]),
    });
    const id = put(g, 'p1', CITIZEN, 'graveyard');
    settle(g);
    const before = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }),
    );
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CITIZEN], []],
      scripts: createRegistry([GALLANT_CITIZEN_SCRIPT]),
    });
    put(g, 'p1', CITIZEN);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
