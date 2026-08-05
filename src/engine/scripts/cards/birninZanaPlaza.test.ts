// `Birnin Zana Plaza` — the gain and the built-in tap, both asserted.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BIRNIN_ZANA_PLAZA_SCRIPT } from './birninZanaPlaza';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PLAZA = 'Birnin Zana Plaza';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Birnin Zana Plaza', () => {
  test('entering gains 1 life AND comes in tapped', () => {
    const g = startedGame({
      players: 2,
      decks: [[PLAZA], []],
      scripts: createRegistry([BIRNIN_ZANA_PLAZA_SCRIPT]),
    });
    const plaza = put(g, 'p1', PLAZA, 'graveyard');
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: plaza,
        to: { kind: 'battlefield', player: 'p1' },
      }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[plaza]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[PLAZA], []],
      scripts: createRegistry([BIRNIN_ZANA_PLAZA_SCRIPT]),
    });
    put(g, 'p1', PLAZA);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
