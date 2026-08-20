// `Devour in Shadow` — the 6/6 dies for 6 of the caster's life; the
// indestructible 0/1 survives and the caster STILL pays 1 (the loss is
// tied to the creature, not the destruction).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEVOUR_IN_SHADOW_SCRIPT } from './devourInShadow';
import { DEVOUR_IN_SHADOW } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function devoured(name: 'Colossal Dreadmaw' | 'Darksteel Myr'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Devour in Shadow'], ['Colossal Dreadmaw', 'Darksteel Myr']],
    scripts: createRegistry([DEVOUR_IN_SHADOW_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Devour in Shadow', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Devour in Shadow', () => {
  test('the 6/6 dies and the caster pays its toughness', () => {
    const { g, victim } = devoured('Colossal Dreadmaw');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(34);
  });

  test('the indestructible 0/1 survives and the caster still pays 1', () => {
    const { g, victim } = devoured('Darksteel Myr');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEVOUR_IN_SHADOW.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEVOUR_IN_SHADOW.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEVOUR_IN_SHADOW.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = devoured('Colossal Dreadmaw');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
