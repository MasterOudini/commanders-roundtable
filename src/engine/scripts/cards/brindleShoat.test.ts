// `Brindle Shoat` — dying leaves a 3/3 Boar behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRINDLE_SHOAT_SCRIPT } from './brindleShoat';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SHOAT = 'Brindle Shoat';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Brindle Shoat', () => {
  test('dying creates a real 3/3 Boar token', () => {
    const g = startedGame({
      players: 2,
      decks: [[SHOAT], []],
      scripts: createRegistry([BRINDLE_SHOAT_SCRIPT]),
    });
    const shoat = put(g, 'p1', SHOAT);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: shoat, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Boar')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SHOAT], []],
      scripts: createRegistry([BRINDLE_SHOAT_SCRIPT]),
    });
    const shoat = put(g, 'p1', SHOAT);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: shoat, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
