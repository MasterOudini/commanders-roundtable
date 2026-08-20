// `Parting Thoughts` — the counter census is taken BEFORE the move.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PARTING_THOUGHTS_SCRIPT } from './partingThoughts';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thought(counters: number): Game {
  const g = startedGame({
    players: 2,
    decks: [['Parting Thoughts'], ['Grizzly Bears']],
    scripts: createRegistry([PARTING_THOUGHTS_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  if (counters > 0) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: bears, kind: '+1/+1', delta: counters }));
  }
  const spell = put(g, 'p1', 'Parting Thoughts', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['B', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  // The spell can resolve INSIDE its own submit under default stops, so
  // both baselines go down BEFORE the cast; the hand delta discounts the
  // spell itself leaving it.
  const before = (g.state.zones.hand['p1'] ?? []).length;
  const lifeBefore = g.state.players['p1']?.life ?? 0;
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  (g as Game & { __delta?: { draw: number; life: number } }).__delta = {
    draw: (g.state.zones.hand['p1'] ?? []).length - (before - 1),
    life: (g.state.players['p1']?.life ?? 0) - lifeBefore,
  };
  return g;
}

describe('Parting Thoughts', () => {
  test('draws and loses per counter on the victim', () => {
    const g = thought(3) as Game & { __delta?: { draw: number; life: number } };
    expect(g.__delta).toEqual({ draw: 3, life: -3 });
  });

  test('a counterless victim means no draw and no loss', () => {
    const g = thought(0) as Game & { __delta?: { draw: number; life: number } };
    expect(g.__delta).toEqual({ draw: 0, life: 0 });
  });

  test('replays to the same hash', () => {
    const g = thought(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
