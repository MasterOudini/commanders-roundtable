// `Striped Bears` — the ETB draw, staged through the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STRIPED_BEARS_SCRIPT } from './stripedBears';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function striped(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Striped Bears'], []],
    scripts: createRegistry([STRIPED_BEARS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const bears = put(g, 'p1', 'Striped Bears', 'graveyard');
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: bears,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  settle(g);
  return { g, before };
}

describe('Striped Bears', () => {
  test('the entry draws a card', () => {
    const { g, before } = striped();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g } = striped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
