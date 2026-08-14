// `Ichor Wellspring` — both arms of one printed line in one game: the entry
// draws, and the death draws again.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ICHOR_WELLSPRING_SCRIPT } from './ichorWellspring';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WELLSPRING = 'Ichor Wellspring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function draws(g: Game): number {
  return g.log.filter(
    (e) =>
      e.body.t === 'CardsMoved' &&
      e.body.moves.some(
        (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === 'p1',
      ),
  ).length;
}

function lived(): Game {
  const g = startedGame({
    players: 2,
    decks: [[WELLSPRING], []],
    scripts: createRegistry([ICHOR_WELLSPRING_SCRIPT]),
  });
  const spring = put(g, 'p1', WELLSPRING);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: spring,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Ichor Wellspring', () => {
  test('entering draws, and dying draws again — both arms of one line', () => {
    const g = lived();
    expect(draws(g)).toBeGreaterThanOrEqual(2);
  });

  test('replays to the same hash', () => {
    const g = lived();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
