// `Poison the Well` — the land dies and its controller takes 2; an
// indestructible land survives and the controller STILL takes 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { POISON_THE_WELL_SCRIPT } from './poisonTheWell';
import { advanceUntil, find, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function poisoned(name: string): { g: Game; target: string } {
  const g = startedGame({
    players: 2,
    decks: [['Poison the Well'], ['Darksteel Citadel']],
    scripts: createRegistry([POISON_THE_WELL_SCRIPT]),
  });
  put(g, 'p2', 'Mountain');
  put(g, 'p2', 'Darksteel Citadel');
  settle(g);
  const target = find(g, 'p2', 'battlefield', name) as string;
  const spell = put(g, 'p1', 'Poison the Well', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: target }] }),
  );
  settle(g);
  return { g, target };
}

describe('Poison the Well', () => {
  test('the Mountain dies and its controller takes 2', () => {
    const { g, target } = poisoned('Mountain');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('an indestructible land survives and the burn still lands', () => {
    const { g, target } = poisoned('Darksteel Citadel');
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g } = poisoned('Mountain');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
