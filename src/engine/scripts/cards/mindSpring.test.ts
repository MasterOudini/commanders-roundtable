// `Mind Spring` — X=3 draws three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MIND_SPRING_SCRIPT } from './mindSpring';
import { MIND_SPRING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sprung(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Mind Spring'], []],
    scripts: createRegistry([MIND_SPRING_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mind Spring', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('Mind Spring', () => {
  test('X=3 draws three', () => {
    const { g, mid } = sprung();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MIND_SPRING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MIND_SPRING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MIND_SPRING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sprung();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
