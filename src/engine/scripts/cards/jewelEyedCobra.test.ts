// `Jewel-Eyed Cobra` — dying leaves a Treasure behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JEWEL_EYED_COBRA_SCRIPT } from './jewelEyedCobra';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const COBRA = 'Jewel-Eyed Cobra';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[COBRA], []],
    scripts: createRegistry([JEWEL_EYED_COBRA_SCRIPT]),
  });
  const cobra = put(g, 'p1', COBRA);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: cobra,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Jewel-Eyed Cobra', () => {
  test('dying creates a Treasure token', () => {
    const g = died();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
