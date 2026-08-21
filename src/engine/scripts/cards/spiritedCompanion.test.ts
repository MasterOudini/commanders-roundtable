// `Spirited Companion` — the ETB draw, staged through the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPIRITED_COMPANION_SCRIPT } from './spiritedCompanion';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function companioned(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Spirited Companion'], []],
    scripts: createRegistry([SPIRITED_COMPANION_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const dog = put(g, 'p1', 'Spirited Companion', 'graveyard');
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: dog,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  settle(g);
  return { g, before };
}

describe('Spirited Companion', () => {
  test('the entry draws a card', () => {
    const { g, before } = companioned();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g } = companioned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
