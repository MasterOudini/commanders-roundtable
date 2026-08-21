// `Rack and Ruin` — two artifacts, one spell.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RACK_AND_RUIN_SCRIPT } from './rackAndRuin';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ruined(): { g: Game; a: string; b: string } {
  const g = startedGame({
    players: 2,
    decks: [['Rack and Ruin'], ['Sol Ring', 'Mind Stone']],
    scripts: createRegistry([RACK_AND_RUIN_SCRIPT]),
  });
  const a = put(g, 'p2', 'Sol Ring');
  const b = put(g, 'p2', 'Mind Stone');
  settle(g);
  const spell = put(g, 'p1', 'Rack and Ruin', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [
        { kind: 'card', id: a },
        { kind: 'card', id: b },
      ],
    }),
  );
  settle(g);
  return { g, a, b };
}

describe('Rack and Ruin', () => {
  test('both artifacts die', () => {
    const { g, a, b } = ruined();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = ruined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
