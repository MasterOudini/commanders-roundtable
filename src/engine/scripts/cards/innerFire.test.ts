// `Inner Fire` — the pool gains one {R} per card in hand at resolution.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INNER_FIRE_SCRIPT } from './innerFire';
import { INNER_FIRE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kindled(): { g: Game; kept: number } {
  const g = startedGame({
    players: 2,
    decks: [['Inner Fire'], ['Grizzly Bears']],
    scripts: createRegistry([INNER_FIRE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Inner Fire', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const kept = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, kept };
}

describe('Inner Fire', () => {
  test('the pool holds one {R} per card left in hand', () => {
    const { g, kept } = kindled();
    expect(kept).toBeGreaterThan(0);
    expect(g.state.players['p1']?.pool.R).toBe(kept);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INNER_FIRE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INNER_FIRE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INNER_FIRE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = kindled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
