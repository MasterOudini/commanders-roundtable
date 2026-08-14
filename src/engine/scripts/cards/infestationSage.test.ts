// `Infestation Sage` — dying leaves a 1/1 flying Insect behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { INFESTATION_SAGE_SCRIPT } from './infestationSage';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SAGE = 'Infestation Sage';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SAGE], []],
    scripts: createRegistry([INFESTATION_SAGE_SCRIPT]),
  });
  const sage = put(g, 'p1', SAGE);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: sage,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Infestation Sage', () => {
  test('dying creates the flying Insect', () => {
    const g = died();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Insect')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
