// `Cleanfall` — Back to Nature's text on its own id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CLEANFALL_SCRIPT } from './cleanfall';
import { CLEANFALL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function felled(): { g: Game; flame: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Cleanfall'], ['Captive Flame']],
    scripts: createRegistry([CLEANFALL_SCRIPT]),
  });
  const flame = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Cleanfall', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, flame };
}

describe('Cleanfall', () => {
  test('the enchantment dies', () => {
    const { g, flame } = felled();
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CLEANFALL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CLEANFALL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CLEANFALL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = felled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
