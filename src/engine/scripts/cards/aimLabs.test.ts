// `A.I.M. Labs` — the ETB gain rides beside D134's enters-tapped built-in.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AIM_LABS_SCRIPT } from './aimLabs';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const LABS = 'A.I.M. Labs';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('A.I.M. Labs', () => {
  test('enters TAPPED and still gains its controller 1 — the two rules compose', () => {
    const g = startedGame({ players: 2, decks: [[LABS], []], scripts: createRegistry([AIM_LABS_SCRIPT]) });
    const id = put(g, 'p1', LABS);
    settle(g);
    expect(g.state.cards[id]?.tapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(41);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
