// `Armada Wurm` — the token must be REAL: named by the oracle, on the
// battlefield, created by the RULES rather than a tool (D133).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARMADA_WURM_SCRIPT } from './armadaWurm';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WURM = 'Armada Wurm';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Armada Wurm', () => {
  test('entering creates a real 5/5 Wurm token for its controller', () => {
    const g = startedGame({
      players: 2,
      decks: [[WURM], []],
      scripts: createRegistry([ARMADA_WURM_SCRIPT]),
    });
    put(g, 'p1', WURM);
    settle(g);
    const tokens = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Wurm');
    expect(tokens).toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[WURM], []],
      scripts: createRegistry([ARMADA_WURM_SCRIPT]),
    });
    put(g, 'p1', WURM);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
