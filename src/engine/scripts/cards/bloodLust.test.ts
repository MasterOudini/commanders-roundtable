// `Blood Lust` — both printed branches: a 6/6 gets +4/-4 (10/2); a 2/2 gets
// +4/-(2-1) (6/1) — never dying of its own pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLOOD_LUST_SCRIPT } from './bloodLust';
import { BLOOD_LUST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(name: 'Colossal Dreadmaw' | 'Grizzly Bears'): { g: Game; target: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Blood Lust', 'Colossal Dreadmaw', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BLOOD_LUST_SCRIPT]),
  });
  const target = put(g, 'p1', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Blood Lust', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target };
}

describe('Blood Lust', () => {
  test('toughness 6: the +4/-4 branch makes a 10/2', () => {
    const { g, target } = cast('Colossal Dreadmaw');
    const d = derive(g.state, ORACLE, g.deps.scripts, target);
    expect(d.power).toBe(10);
    expect(d.toughness).toBe(2);
  });

  test('toughness 2: the Otherwise branch makes a 6/1 — it never kills', () => {
    const { g, target } = cast('Grizzly Bears');
    const d = derive(g.state, ORACLE, g.deps.scripts, target);
    expect(d.power).toBe(6);
    expect(d.toughness).toBe(1);
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLOOD_LUST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLOOD_LUST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLOOD_LUST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
