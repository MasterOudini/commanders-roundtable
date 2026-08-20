// `Penumbra Spider` — the middle shadow, with reach.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PENUMBRA_SPIDER_SCRIPT } from './penumbraSpider';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shadowed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Penumbra Spider'], []],
    scripts: createRegistry([PENUMBRA_SPIDER_SCRIPT]),
  });
  const spider = put(g, 'p1', 'Penumbra Spider');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: spider, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  return g;
}

describe('Penumbra Spider', () => {
  test('dying leaves a 2/4 black Spider token', () => {
    const g = shadowed();
    const spiders = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Spider');
    expect(spiders).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = shadowed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
