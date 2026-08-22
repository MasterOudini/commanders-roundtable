// `Tasha's Hideous Laughter` — the accumulate-until-a-BUDGET loop.
//
// ⚠️ Both cases are engineered, and the SECOND is the honest one: a padded
// library is basic lands, whose mana value is ZERO, so the total never
// reaches 20 and the whole library is exiled. That is the card working, not
// the loop running away — and it is exactly the board a real Commander game
// full of lands produces at the tail.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TASHAS_HIDEOUS_LAUGHTER_SCRIPT } from './tashasHideousLaughter';
import { TASHA_S_HIDEOUS_LAUGHTER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const LAUGHTER = "Tasha's Hideous Laughter";
const TITAN = 'Grave Titan'; // {4}{B}{B} — mana value 6

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function laughed(titans: number): { g: Game; libBefore: number } {
  const deck: string[] = [];
  for (let i = 0; i < titans; i++) deck.push(TITAN);
  const g = startedGame({
    players: 2,
    decks: [[LAUGHTER], deck],
    scripts: createRegistry([TASHAS_HIDEOUS_LAUGHTER_SCRIPT]),
  });
  holdEverywhere(g);
  // Stack the Titans on top, so the run's length is arithmetic, not luck.
  for (let i = 0; i < titans; i++) {
    const id = put(g, 'p2', TITAN, 'graveyard');
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p2',
        card: id,
        to: { kind: 'library', player: 'p2' },
        placement: 'top',
      }),
    );
  }
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const libBefore = (g.state.zones.library['p2'] ?? []).length;
  const spell = put(g, 'p1', LAUGHTER, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, libBefore };
}

describe("Tasha's Hideous Laughter", () => {
  test('FOUR mana-value-6 cards cross 20 and the run stops there', () => {
    const { g, libBefore } = laughed(4);
    const exiled = (g.state.zones.exile['p2'] ?? []).length;
    // 6 + 6 + 6 = 18 is short; the fourth card crosses at 24 and is exiled too.
    expect(exiled).toBe(4);
    expect((g.state.zones.library['p2'] ?? []).length).toBe(libBefore - 4);
  });

  test('a library of nothing but lands is exiled WHOLE — mana value 0 never reaches 20', () => {
    const { g } = laughed(0);
    expect(g.state.zones.library['p2'] ?? []).toHaveLength(0);
    expect((g.state.zones.exile['p2'] ?? []).length).toBeGreaterThan(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TASHA_S_HIDEOUS_LAUGHTER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TASHA_S_HIDEOUS_LAUGHTER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TASHA_S_HIDEOUS_LAUGHTER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = laughed(4);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
