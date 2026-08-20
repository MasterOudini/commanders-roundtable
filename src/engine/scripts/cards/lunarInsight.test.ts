// `Lunar Insight` — mv 1 and mv 2 twice make TWO different values: two
// cards, and lands count nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LUNAR_INSIGHT_SCRIPT } from './lunarInsight';
import { LUNAR_INSIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mooned(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Lunar Insight', 'Sol Ring', 'Grizzly Bears', 'Grizzly Bears', 'Swamp'], []],
    scripts: createRegistry([LUNAR_INSIGHT_SCRIPT]),
  });
  put(g, 'p1', 'Sol Ring');
  const a = put(g, 'p1', 'Grizzly Bears');
  const b = put(g, 'p1', 'Grizzly Bears');
  expect(b).not.toBe(a);
  put(g, 'p1', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Lunar Insight', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('Lunar Insight', () => {
  test('mv {1, 2} among nonlands: two cards; the Swamp counts nothing', () => {
    const { g, mid } = mooned();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LUNAR_INSIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LUNAR_INSIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LUNAR_INSIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = mooned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
