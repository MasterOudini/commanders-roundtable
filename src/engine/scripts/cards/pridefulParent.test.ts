// `Prideful Parent` — the entry brings a kitten.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRIDEFUL_PARENT_SCRIPT } from './pridefulParent';
import { advanceUntil, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function parented(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Prideful Parent'], []],
    scripts: createRegistry([PRIDEFUL_PARENT_SCRIPT]),
  });
  put(g, 'p1', 'Prideful Parent');
  settle(g);
  return g;
}

describe('Prideful Parent', () => {
  test('entering mints a 1/1 white Cat', () => {
    const g = parented();
    const cats = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Cat');
    expect(cats).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = parented();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
