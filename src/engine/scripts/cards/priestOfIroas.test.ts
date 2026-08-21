// `Priest of Iroas` — the priest trades itself for an enchantment.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRIEST_OF_IROAS_SCRIPT } from './priestOfIroas';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function traded(): { g: Game; priest: string; enchantment: string } {
  const g = startedGame({
    players: 2,
    decks: [['Priest of Iroas'], ['Contemplation']],
    scripts: createRegistry([PRIEST_OF_IROAS_SCRIPT]),
  });
  const priest = put(g, 'p1', 'Priest of Iroas');
  const enchantment = put(g, 'p2', 'Contemplation');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  for (const sym of ['W', 'C', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: priest,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: enchantment }],
    }),
  );
  settle(g);
  return { g, priest, enchantment };
}

describe('Priest of Iroas', () => {
  test('the priest dies paying and the enchantment follows', () => {
    const { g, priest, enchantment } = traded();
    expect(g.state.cards[priest]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[enchantment]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = traded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
