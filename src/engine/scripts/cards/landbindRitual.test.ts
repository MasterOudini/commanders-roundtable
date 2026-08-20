// `Landbind Ritual` — two Plains gain me 4; the Swamp counts nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LANDBIND_RITUAL_SCRIPT } from './landbindRitual';
import { LANDBIND_RITUAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bound(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Landbind Ritual', 'Plains', 'Plains', 'Swamp'], []],
    scripts: createRegistry([LANDBIND_RITUAL_SCRIPT]),
  });
  const a = put(g, 'p1', 'Plains');
  const b = put(g, 'p1', 'Plains');
  expect(b).not.toBe(a);
  put(g, 'p1', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Landbind Ritual', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g };
}

describe('Landbind Ritual', () => {
  test('two Plains gain exactly 4', () => {
    const { g } = bound();
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LANDBIND_RITUAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LANDBIND_RITUAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LANDBIND_RITUAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bound();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
