// `Tolarian Winds` — the wheel with no shuffle: the whole hand goes, the same
// number comes back, and no prompt is ever raised.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TOLARIAN_WINDS_SCRIPT } from './tolarianWinds';
import { TOLARIAN_WINDS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Tolarian Winds';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blown(): { g: Game; handBefore: number; graveBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([TOLARIAN_WINDS_SCRIPT]),
  });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  // ⚠️ Captured AFTER the put and BEFORE the cast: the Winds leave the hand
  // as they go on the stack, so the count that matters is the one the resolve
  // will see (D232 — a spell can resolve inside its own submit).
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const handBefore = (g.state.zones.hand['p1'] ?? []).length;
  const graveBefore = (g.state.zones.graveyard['p1'] ?? []).length;
  settle(g);
  return { g, handBefore, graveBefore };
}

describe('Tolarian Winds', () => {
  test('the whole hand is discarded and exactly that many are drawn', () => {
    const { g, handBefore, graveBefore } = blown();
    expect(handBefore).toBeGreaterThan(0);
    const hand = g.state.zones.hand['p1'] ?? [];
    const grave = g.state.zones.graveyard['p1'] ?? [];
    expect(hand).toHaveLength(handBefore);
    // The discarded hand plus the Winds themselves.
    expect(grave.length).toBe(graveBefore + handBefore + 1);
  });

  test('nothing is ever asked — the discard is choiceless (CR 701.8a)', () => {
    const { g } = blown();
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TOLARIAN_WINDS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TOLARIAN_WINDS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TOLARIAN_WINDS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = blown();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
