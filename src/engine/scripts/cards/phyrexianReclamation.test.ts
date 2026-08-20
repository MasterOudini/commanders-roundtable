// `Phyrexian Reclamation` — two life and two mana buy a creature back;
// a land card in the same graveyard is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PHYREXIAN_RECLAMATION_SCRIPT } from './phyrexianReclamation';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reclaimed(): { g: Game; bears: string; island: string; enchantment: string } {
  const g = startedGame({
    players: 2,
    decks: [['Phyrexian Reclamation', 'Grizzly Bears'], []],
    scripts: createRegistry([PHYREXIAN_RECLAMATION_SCRIPT]),
  });
  const enchantment = put(g, 'p1', 'Phyrexian Reclamation');
  const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  const island = put(g, 'p1', 'Island', 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  for (const sym of ['B', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  return { g, bears, island, enchantment };
}

describe('Phyrexian Reclamation', () => {
  test('returns the creature card and charges 2 life', () => {
    const { g, bears, enchantment } = reclaimed();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: enchantment,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('a land card in the graveyard is not a creature card', () => {
    const { g, island, enchantment } = reclaimed();
    const res = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: enchantment,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: island }],
    });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bears, enchantment } = reclaimed();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: enchantment,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
