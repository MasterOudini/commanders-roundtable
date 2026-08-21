// `Shaman of Spring` — the ETB draw, staged through the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHAMAN_OF_SPRING_SCRIPT } from './shamanOfSpring';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Shaman of Spring', () => {
  test('entering draws a card', () => {
    const g = startedGame({
      players: 2,
      decks: [['Shaman of Spring'], []],
      scripts: createRegistry([SHAMAN_OF_SPRING_SCRIPT]),
    });
    const id = put(g, 'p1', 'Shaman of Spring', 'graveyard');
    settle(g);
    const before = (g.state.zones.hand['p1'] ?? []).length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: id,
        to: { kind: 'battlefield', player: 'p1' },
      }),
    );
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Shaman of Spring'], []],
      scripts: createRegistry([SHAMAN_OF_SPRING_SCRIPT]),
    });
    put(g, 'p1', 'Shaman of Spring');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
