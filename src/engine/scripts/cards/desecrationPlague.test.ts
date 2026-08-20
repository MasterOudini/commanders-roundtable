// `Desecration Plague` — an enchantment target and a land target both die.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DESECRATION_PLAGUE_SCRIPT } from './desecrationPlague';
import { DESECRATION_PLAGUE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function plagued(name: 'Captive Flame' | 'Mountain'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Desecration Plague'], ['Captive Flame', 'Mountain']],
    scripts: createRegistry([DESECRATION_PLAGUE_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Desecration Plague', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Desecration Plague', () => {
  test('an enchantment dies to it', () => {
    const { g, victim } = plagued('Captive Flame');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('a land dies to it', () => {
    const { g, victim } = plagued('Mountain');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DESECRATION_PLAGUE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DESECRATION_PLAGUE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DESECRATION_PLAGUE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = plagued('Mountain');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
