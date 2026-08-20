// `Golden Ratio` — DIFFERENT powers: two Bears share one, the Herder
// brings the other — two draws, not three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GOLDEN_RATIO_SCRIPT } from './goldenRatio';
import { GOLDEN_RATIO } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function measured(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Golden Ratio', 'Elvish Herder', 'Grizzly Bears', 'Grizzly Bears'],
      ['Colossal Dreadmaw'],
    ],
    scripts: createRegistry([GOLDEN_RATIO_SCRIPT]),
  });
  put(g, 'p1', 'Elvish Herder');
  const a = put(g, 'p1', 'Grizzly Bears');
  const b = put(g, 'p1', 'Grizzly Bears');
  expect(b).not.toBe(a);
  put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Golden Ratio', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('Golden Ratio', () => {
  test("powers {1, 2} draw two — the opponent's 6/6 counts nothing", () => {
    const { g, mid } = measured();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GOLDEN_RATIO.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GOLDEN_RATIO.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GOLDEN_RATIO.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = measured();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
