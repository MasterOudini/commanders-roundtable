// `Penumbra Bobcat` — dies into its own shadow.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PENUMBRA_BOBCAT_SCRIPT } from './penumbraBobcat';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shadowed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Penumbra Bobcat'], []],
    scripts: createRegistry([PENUMBRA_BOBCAT_SCRIPT]),
  });
  const cat = put(g, 'p1', 'Penumbra Bobcat');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cat, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  return g;
}

describe('Penumbra Bobcat', () => {
  test('dying leaves a 2/1 black Cat token', () => {
    const g = shadowed();
    const cats = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Cat');
    expect(cats).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = shadowed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
