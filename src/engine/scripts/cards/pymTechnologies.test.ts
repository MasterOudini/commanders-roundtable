// `Pym Technologies` — enters tapped, pays 1 on the way in.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PYM_TECHNOLOGIES_SCRIPT } from './pymTechnologies';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Pym Technologies', () => {
  test('enters TAPPED and gains 1', () => {
    const g = startedGame({
      players: 2,
      decks: [['Pym Technologies'], []],
      scripts: createRegistry([PYM_TECHNOLOGIES_SCRIPT]),
    });
    const lab = put(g, 'p1', 'Pym Technologies');
    settle(g);
    expect(g.state.cards[lab]?.tapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Pym Technologies'], []],
      scripts: createRegistry([PYM_TECHNOLOGIES_SCRIPT]),
    });
    put(g, 'p1', 'Pym Technologies');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
