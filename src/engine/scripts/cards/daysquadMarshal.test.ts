// `Daysquad Marshal` — the ETB Human Soldier, by its exact printing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DAYSQUAD_MARSHAL_SCRIPT } from './daysquadMarshal';
import { HUMAN_SOLDIER_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MARSHAL = 'Daysquad Marshal';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[MARSHAL], []],
    scripts: createRegistry([DAYSQUAD_MARSHAL_SCRIPT]),
  });
}

describe('Daysquad Marshal', () => {
  test('entering creates the Human Soldier, by its exact printing', () => {
    const g = game();
    put(g, 'p1', MARSHAL);
    settle(g);
    const tokens = Object.values(g.state.cards).filter((c) => c.isToken);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.printingId).toBe(HUMAN_SOLDIER_TOKEN.scryfallId);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', MARSHAL);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
