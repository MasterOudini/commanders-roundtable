// `Archivist` — "{T}: Draw a card."; Arcane Encyclopedia without the mana.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARCHIVIST_SCRIPT } from './archivist';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Archivist', () => {
  test('taps to draw, and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [['Archivist'], []],
      scripts: createRegistry([ARCHIVIST_SCRIPT]),
    });
    const id = put(g, 'p1', 'Archivist');
    settle(g);
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 0 }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
    expect(g.state.cards[id]?.tapped).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
