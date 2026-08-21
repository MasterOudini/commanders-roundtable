// `Rain of Salt` — two lands salted.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAIN_OF_SALT_SCRIPT } from './rainOfSalt';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function salted(): { g: Game; a: string; b: string } {
  const g = startedGame({
    players: 2,
    decks: [['Rain of Salt'], []],
    scripts: createRegistry([RAIN_OF_SALT_SCRIPT]),
  });
  const a = put(g, 'p2', 'Mountain');
  const b = put(g, 'p2', 'Swamp');
  settle(g);
  const spell = put(g, 'p1', 'Rain of Salt', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
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

describe('Rain of Salt', () => {
  test('both lands die', () => {
    const { g, a, b } = salted();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = salted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
