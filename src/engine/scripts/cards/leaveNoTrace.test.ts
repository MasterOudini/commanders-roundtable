// `Leave No Trace` — the red target and its red kin die; the blue
// enchantment is spared.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LEAVE_NO_TRACE_SCRIPT } from './leaveNoTrace';
import { LEAVE_NO_TRACE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function traced(): { g: Game; flame: InstanceId; cry: InstanceId; plans: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Leave No Trace'], ['Captive Flame', 'Ghitu War Cry', 'Hatching Plans']],
    scripts: createRegistry([LEAVE_NO_TRACE_SCRIPT]),
  });
  const flame = put(g, 'p2', 'Captive Flame');
  const cry = put(g, 'p2', 'Ghitu War Cry');
  const plans = put(g, 'p2', 'Hatching Plans');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Leave No Trace', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: flame }] }));
  settle(g);
  return { g, flame, cry, plans };
}

describe('Leave No Trace', () => {
  test('the red target and the red bystander die; the blue enchantment stands', () => {
    const { g, flame, cry, plans } = traced();
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[cry]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[plans]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LEAVE_NO_TRACE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LEAVE_NO_TRACE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LEAVE_NO_TRACE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = traced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
