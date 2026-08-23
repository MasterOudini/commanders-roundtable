// `Vision Skeins` — EACH player draws two, mine included.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VISION_SKEINS_SCRIPT } from './visionSkeins';
import { VISION_SKEINS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Vision Skeins';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; before: { p1: number; p2: number } } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([VISION_SKEINS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  // ⚠️ The baseline is taken AFTER the put, which moved a card into my hand.
  const before = {
    p1: (g.state.zones.hand['p1'] ?? []).length,
    p2: (g.state.zones.hand['p2'] ?? []).length,
  };
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, before };
}

describe('Vision Skeins', () => {
  test('both players draw two — the caster nets one, the Skeins having left', () => {
    const { g, before } = cast();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before.p1 - 1 + 2);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before.p2 + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VISION_SKEINS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VISION_SKEINS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VISION_SKEINS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
