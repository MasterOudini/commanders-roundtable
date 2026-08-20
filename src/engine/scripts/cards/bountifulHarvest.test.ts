// `Bountiful Harvest` — 1 life per land I control.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BOUNTIFUL_HARVEST_SCRIPT } from './bountifulHarvest';
import { BOUNTIFUL_HARVEST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function harvested(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Bountiful Harvest', 'Mountain', 'Mountain'], ['Grizzly Bears']],
    scripts: createRegistry([BOUNTIFUL_HARVEST_SCRIPT]),
  });
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Bountiful Harvest', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Bountiful Harvest', () => {
  test('two lands pay 2 life', () => {
    const g = harvested();
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BOUNTIFUL_HARVEST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BOUNTIFUL_HARVEST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BOUNTIFUL_HARVEST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = harvested();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
