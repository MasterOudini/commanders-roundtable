// `Opportunity` — the target draws four.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { OPPORTUNITY_SCRIPT } from './opportunity';
import { OPPORTUNITY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function opportuned(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Opportunity'], []],
    scripts: createRegistry([OPPORTUNITY_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Opportunity', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  const before = (g.state.zones.hand['p2'] ?? []).length;
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return { g, before };
}

describe('Opportunity', () => {
  test('the target draws four', () => {
    const { g, before } = opportuned();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before + 4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = OPPORTUNITY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, OPPORTUNITY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(OPPORTUNITY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = opportuned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
