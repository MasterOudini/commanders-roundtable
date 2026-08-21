// `Racers' Ring` — the ring pays itself for a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RACERS_RING_SCRIPT } from './racersRing';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function raced(): { g: Game; ring: string; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [["Racers' Ring"], []],
    scripts: createRegistry([RACERS_RING_SCRIPT]),
  });
  const ring = put(g, 'p1', "Racers' Ring");
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ring], tapped: false }));
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  for (const sym of ['R', 'G', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  const logAt = g.log.length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ring, abilityIndex: 1 }));
  settle(g);
  const drew = g.log
    .slice(logAt)
    .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
    .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').length;
  return { g, ring, drew };
}

describe('Racers Ring', () => {
  test('pays itself and draws one', () => {
    const { g, ring, drew } = raced();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(drew).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = raced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
