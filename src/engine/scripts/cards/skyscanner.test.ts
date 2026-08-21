// `Skyscanner` — the ETB draw, staged through the graveyard so the opening
// hand cannot race the baseline (the Gallant Citizen idiom).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKYSCANNER_SCRIPT } from './skyscanner';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scanned(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Skyscanner'], []],
    scripts: createRegistry([SKYSCANNER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const scanner = put(g, 'p1', 'Skyscanner', 'graveyard');
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: scanner,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  settle(g);
  return { g, before };
}

describe('Skyscanner', () => {
  test('the entry draws a card', () => {
    const { g, before } = scanned();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g } = scanned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
