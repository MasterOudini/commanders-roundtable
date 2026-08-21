// `Putrefy` — both arms of the compound, and indestructible holds.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PUTREFY_SCRIPT } from './putrefy';
import { advanceUntil, find, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rotted(name: string): { g: Game; target: string } {
  const g = startedGame({
    players: 2,
    decks: [['Putrefy'], ['Sol Ring', 'Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([PUTREFY_SCRIPT]),
  });
  put(g, 'p2', 'Sol Ring');
  put(g, 'p2', 'Grizzly Bears');
  put(g, 'p2', 'Darksteel Myr');
  settle(g);
  const target = find(g, 'p2', 'battlefield', name) as string;
  const spell = put(g, 'p1', 'Putrefy', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['B', 'G', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: target }] }),
  );
  settle(g);
  return { g, target };
}

describe('Putrefy', () => {
  test('the artifact arm takes a Sol Ring', () => {
    const { g, target } = rotted('Sol Ring');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('the creature arm takes a Bears', () => {
    const { g, target } = rotted('Grizzly Bears');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('an indestructible artifact creature survives', () => {
    const { g, target } = rotted('Darksteel Myr');
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = rotted('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
