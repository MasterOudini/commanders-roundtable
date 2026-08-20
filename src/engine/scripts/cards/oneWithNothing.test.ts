// `One with Nothing` — the whole hand goes, choicelessly.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ONE_WITH_NOTHING_SCRIPT } from './oneWithNothing';
import { ONE_WITH_NOTHING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function nothinged(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['One with Nothing'], []],
    scripts: createRegistry([ONE_WITH_NOTHING_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'One with Nothing', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('One with Nothing', () => {
  test('the whole hand goes, no ask', () => {
    const { g, mid } = nothinged();
    expect(mid).toBeGreaterThan(0);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(0);
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseFromZone');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ONE_WITH_NOTHING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ONE_WITH_NOTHING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ONE_WITH_NOTHING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = nothinged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
