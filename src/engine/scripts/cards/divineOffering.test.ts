// `Divine Offering` — the artifact dies and its mana value comes back as
// life; the indestructible artifact survives and still pays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DIVINE_OFFERING_SCRIPT } from './divineOffering';
import { DIVINE_OFFERING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function offered(name: 'Sol Ring' | 'Darksteel Myr'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Divine Offering'], ['Sol Ring', 'Darksteel Myr']],
    scripts: createRegistry([DIVINE_OFFERING_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Divine Offering', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Divine Offering', () => {
  test('the artifact dies and its MV comes back as life', () => {
    const { g, victim } = offered('Sol Ring');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('Darksteel Myr survives and still pays its MV', () => {
    const { g, victim } = offered('Darksteel Myr');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DIVINE_OFFERING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DIVINE_OFFERING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DIVINE_OFFERING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = offered('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
