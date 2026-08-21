// `Symbiotic Wurm` — SEVEN distinct Insects on one death: the largest token
// drop of the arc (past Hornet Queen's four), and D164's allocator teeth at
// their widest.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SYMBIOTIC_WURM_SCRIPT } from './symbioticWurm';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WURM = 'Symbiotic Wurm';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function killed(): Game {
  const g = startedGame({
    players: 2,
    decks: [[WURM], []],
    scripts: createRegistry([SYMBIOTIC_WURM_SCRIPT]),
  });
  const wurm = put(g, 'p1', WURM);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: wurm,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Symbiotic Wurm', () => {
  test('dying creates SEVEN distinct 1/1 Insects', () => {
    const g = killed();
    const insects = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Insect');
    expect(insects).toHaveLength(7);
    expect(new Set(insects).size).toBe(7);
  });

  test('replays to the same hash', () => {
    const g = killed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
