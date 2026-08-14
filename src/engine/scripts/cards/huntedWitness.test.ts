// `Hunted Witness` — dying leaves a lifelink Soldier behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HUNTED_WITNESS_SCRIPT } from './huntedWitness';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WITNESS = 'Hunted Witness';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[WITNESS], []],
    scripts: createRegistry([HUNTED_WITNESS_SCRIPT]),
  });
  const witness = put(g, 'p1', WITNESS);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: witness,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Hunted Witness', () => {
  test('dying creates the lifelink Soldier', () => {
    const g = died();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Soldier')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
