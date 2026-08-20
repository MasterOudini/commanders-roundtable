// `Inner Struggle` — the 6/6 punches itself to death; a 1/2 survives its
// own fist.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INNER_STRUGGLE_SCRIPT } from './innerStruggle';
import { INNER_STRUGGLE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function struggled(name: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Inner Struggle', 'Inner Struggle'], ['Colossal Dreadmaw', 'Giant Spider']],
    scripts: createRegistry([INNER_STRUGGLE_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Inner Struggle', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Inner Struggle', () => {
  test('the 6/6 kills itself', () => {
    const { g, victim } = struggled('Colossal Dreadmaw');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('the 2/4 marks its own 2 and stands', () => {
    const { g, victim } = struggled('Giant Spider');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[victim]?.damage).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INNER_STRUGGLE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INNER_STRUGGLE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INNER_STRUGGLE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = struggled('Colossal Dreadmaw');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
