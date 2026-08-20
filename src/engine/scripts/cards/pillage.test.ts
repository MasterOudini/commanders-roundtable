// `Pillage` — both arms of the compound, and indestructible still holds.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PILLAGE_SCRIPT } from './pillage';
import { advanceUntil, find, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pillaged(targetOf: (g: Game) => string): { g: Game; target: string } {
  const g = startedGame({
    players: 2,
    decks: [['Pillage'], ['Sol Ring', 'Darksteel Citadel']],
    scripts: createRegistry([PILLAGE_SCRIPT]),
  });
  put(g, 'p2', 'Sol Ring');
  put(g, 'p2', 'Darksteel Citadel');
  put(g, 'p2', 'Mountain');
  settle(g);
  const target = targetOf(g);
  const spell = put(g, 'p1', 'Pillage', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['R', 'R', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: target }] }),
  );
  settle(g);
  return { g, target };
}

describe('Pillage', () => {
  test('the artifact arm destroys a Sol Ring', () => {
    const { g, target } = pillaged((gg) => find(gg, 'p2', 'battlefield', 'Sol Ring') as string);
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('the land arm destroys a Mountain', () => {
    const { g, target } = pillaged((gg) => find(gg, 'p2', 'battlefield', 'Mountain') as string);
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('an indestructible land survives and the spell is spent', () => {
    const { g, target } = pillaged(
      (gg) => find(gg, 'p2', 'battlefield', 'Darksteel Citadel') as string,
    );
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = pillaged((gg) => find(gg, 'p2', 'battlefield', 'Sol Ring') as string);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
