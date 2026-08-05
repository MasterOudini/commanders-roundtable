// `Conclave Cavalier` — dying makes TWO distinct Elf Knights (D164's
// allocator teeth on a dies trigger).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CONCLAVE_CAVALIER_SCRIPT } from './conclaveCavalier';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CAVALIER = 'Conclave Cavalier';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Conclave Cavalier', () => {
  test('dying creates TWO distinct 2/2 Elf Knight tokens', () => {
    const g = startedGame({
      players: 2,
      decks: [[CAVALIER], []],
      scripts: createRegistry([CONCLAVE_CAVALIER_SCRIPT]),
    });
    const cavalier = put(g, 'p1', CAVALIER);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: cavalier,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    const knights = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Elf Knight');
    expect(knights).toHaveLength(2);
    expect(new Set(knights).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CAVALIER], []],
      scripts: createRegistry([CONCLAVE_CAVALIER_SCRIPT]),
    });
    const cavalier = put(g, 'p1', CAVALIER);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: cavalier,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
