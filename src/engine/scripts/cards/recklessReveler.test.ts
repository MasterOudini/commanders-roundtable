// `Reckless Reveler` — trades itself for an artifact.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RECKLESS_REVELER_SCRIPT } from './recklessReveler';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reveled(): { g: Game; reveler: string; ring: string } {
  const g = startedGame({
    players: 2,
    decks: [['Reckless Reveler'], ['Sol Ring']],
    scripts: createRegistry([RECKLESS_REVELER_SCRIPT]),
  });
  const reveler = put(g, 'p1', 'Reckless Reveler');
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: reveler,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: ring }],
    }),
  );
  settle(g);
  return { g, reveler, ring };
}

describe('Reckless Reveler', () => {
  test('the Reveler and the Ring both die', () => {
    const { g, reveler, ring } = reveled();
    expect(g.state.cards[reveler]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = reveled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
