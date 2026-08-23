// `Union of the Third Path` — the gain INCLUDES the card just drawn, which is
// the whole arithmetic of the card and the branch a pre-resolution read gets
// wrong by exactly one.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNION_OF_THE_THIRD_PATH_SCRIPT } from './unionOfTheThirdPath';
import { UNION_OF_THE_THIRD_PATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Union of the Third Path';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function united(): { g: Game; handBefore: number; lifeBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([UNION_OF_THE_THIRD_PATH_SCRIPT]),
  });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  // ⚠️ Captured AFTER the cast: the spell has left the hand for the stack, so
  // this is the hand the resolve will actually see (D232).
  const handBefore = (g.state.zones.hand['p1'] ?? []).length;
  const lifeBefore = g.state.players.p1?.life ?? 0;
  settle(g);
  return { g, handBefore, lifeBefore };
}

describe('Union of the Third Path', () => {
  test('the gain counts the DRAWN card too: hand + 1', () => {
    const { g, handBefore, lifeBefore } = united();
    const hand = (g.state.zones.hand['p1'] ?? []).length;
    expect(hand).toBe(handBefore + 1);
    // The life gained equals the hand size AFTER the draw, which is what the
    // card says and is one more than a pre-resolution read would give.
    expect((g.state.players.p1?.life ?? 0) - lifeBefore).toBe(handBefore + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNION_OF_THE_THIRD_PATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNION_OF_THE_THIRD_PATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNION_OF_THE_THIRD_PATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = united();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
