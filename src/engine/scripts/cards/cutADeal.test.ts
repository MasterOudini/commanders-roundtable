// `Cut a Deal` — the opponent draws one and the caster draws one per
// drawer.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CUT_ADEAL_SCRIPT } from './cutADeal';
import { CUT_A_DEAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dealt(): { g: Game; mine: number; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [['Cut a Deal'], ['Grizzly Bears']],
    scripts: createRegistry([CUT_ADEAL_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Cut a Deal', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length - 1;
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('Cut a Deal', () => {
  test('the one opponent draws one; the caster draws one back', () => {
    const { g, mine, theirs } = dealt();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 1);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CUT_A_DEAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CUT_A_DEAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CUT_A_DEAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = dealt();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
