// `Frantic Inventory` — two dead copies draw 1 + 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FRANTIC_INVENTORY_SCRIPT } from './franticInventory';
import { FRANTIC_INVENTORY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function inventoried(): { g: Game; mine: number } {
  const g = startedGame({
    players: 2,
    decks: [['Frantic Inventory', 'Frantic Inventory', 'Frantic Inventory'], ['Grizzly Bears']],
    scripts: createRegistry([FRANTIC_INVENTORY_SCRIPT]),
  });
  const a = put(g, 'p1', 'Frantic Inventory', 'graveyard');
  const b = put(g, 'p1', 'Frantic Inventory', 'graveyard');
  expect(b).not.toBe(a);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Frantic Inventory', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine };
}

describe('Frantic Inventory', () => {
  test('two dead copies draw 1 + 2', () => {
    const { g, mine } = inventoried();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine + 3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FRANTIC_INVENTORY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FRANTIC_INVENTORY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FRANTIC_INVENTORY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = inventoried();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
