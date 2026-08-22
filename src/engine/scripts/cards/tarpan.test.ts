// `Tarpan` — the plain dies-gain at one.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TARPAN_SCRIPT } from './tarpan';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TARPAN = 'Tarpan';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function killed(): Game {
  const g = startedGame({
    players: 2,
    decks: [[TARPAN], []],
    scripts: createRegistry([TARPAN_SCRIPT]),
  });
  const tarpan = put(g, 'p1', TARPAN);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: tarpan,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Tarpan', () => {
  test('dying gains 1 life', () => {
    expect(killed().state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = killed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
