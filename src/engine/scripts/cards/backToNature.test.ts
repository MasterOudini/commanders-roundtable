// `Back to Nature` — the enchantment wipe: both sides' enchantments die,
// creatures stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BACK_TO_NATURE_SCRIPT } from './backToNature';
import { BACK_TO_NATURE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swept(): { g: Game; mine: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Back to Nature', 'Grizzly Bears'], ['Captive Flame']],
    scripts: createRegistry([BACK_TO_NATURE_SCRIPT]),
  });
  const mine = put(g, 'p2', 'Captive Flame');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Back to Nature', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, bears };
}

describe('Back to Nature', () => {
  test('the enchantment dies; the creature stands', () => {
    const { g, mine, bears } = swept();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BACK_TO_NATURE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BACK_TO_NATURE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BACK_TO_NATURE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
