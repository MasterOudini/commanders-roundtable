// `Burning Cloak` — the pump lands and the 2 damage marks: a 2/2 becomes a
// 4/2 with 2 marked and dies to the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BURNING_CLOAK_SCRIPT } from './burningCloak';
import { BURNING_CLOAK } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cloaked(name: 'Grizzly Bears' | 'Colossal Dreadmaw'): { g: Game; target: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Burning Cloak', 'Grizzly Bears', 'Colossal Dreadmaw'], ['Grizzly Bears']],
    scripts: createRegistry([BURNING_CLOAK_SCRIPT]),
  });
  const target = put(g, 'p1', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Burning Cloak', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target };
}

describe('Burning Cloak', () => {
  test('a 2/2 takes the pump AND dies of the 2 damage', () => {
    const { g, target } = cloaked('Grizzly Bears');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  test('a 6/6 keeps the pump with 2 marked', () => {
    const { g, target } = cloaked('Colossal Dreadmaw');
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[target]?.damage).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BURNING_CLOAK.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BURNING_CLOAK.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BURNING_CLOAK.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cloaked('Colossal Dreadmaw');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
