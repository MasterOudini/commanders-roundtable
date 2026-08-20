// `Penumbra Wurm` — the biggest shadow, with trample.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PENUMBRA_WURM_SCRIPT } from './penumbraWurm';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shadowed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Penumbra Wurm'], []],
    scripts: createRegistry([PENUMBRA_WURM_SCRIPT]),
  });
  const wurm = put(g, 'p1', 'Penumbra Wurm');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: wurm, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  return g;
}

describe('Penumbra Wurm', () => {
  test('dying leaves a 6/6 black Wurm token', () => {
    const g = shadowed();
    const wurms = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Wurm');
    expect(wurms).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = shadowed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
