// `Liturgy of Blood` — the destroy lands and the {B}{B}{B} arrives; an
// indestructible miss still pays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LITURGY_OF_BLOOD_SCRIPT } from './liturgyOfBlood';
import { LITURGY_OF_BLOOD } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function performed(name: string): { g: Game; target: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Liturgy of Blood', 'Liturgy of Blood'], ['Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([LITURGY_OF_BLOOD_SCRIPT]),
  });
  const target = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Liturgy of Blood', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target };
}

describe('Liturgy of Blood', () => {
  test('the 2/2 dies and the pool holds {B}{B}{B}', () => {
    const { g, target } = performed('Grizzly Bears');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.pool.B).toBe(3);
  });

  test('the indestructible Myr survives and the mana STILL arrives (CR 608.2c)', () => {
    const { g, target } = performed('Darksteel Myr');
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.pool.B).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LITURGY_OF_BLOOD.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LITURGY_OF_BLOOD.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LITURGY_OF_BLOOD.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = performed('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
