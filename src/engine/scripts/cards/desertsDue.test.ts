// `Desert's Due` — the base -2/-2 alone kills the 2/2 with no Deserts; two
// Deserts deepen it to -4/-4 and the surviving 6/6 reads exactly 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DESERTS_DUE_SCRIPT } from './desertsDue';
import { DESERT_S_DUE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function collected(
  name: 'Grizzly Bears' | 'Colossal Dreadmaw',
  deserts: number,
): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ["Desert's Due", 'Sunscorched Desert', 'Sunscorched Desert'],
      ['Grizzly Bears', 'Colossal Dreadmaw'],
    ],
    scripts: createRegistry([DESERTS_DUE_SCRIPT]),
  });
  for (let i = 0; i < deserts; i++) put(g, 'p1', 'Sunscorched Desert');
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Desert's Due", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe("Desert's Due", () => {
  test('with zero Deserts the base -2/-2 kills the 2/2', () => {
    const { g, victim } = collected('Grizzly Bears', 0);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('two Deserts deepen it to -4/-4 — the 6/6 reads exactly 2', () => {
    const { g, victim } = collected('Colossal Dreadmaw', 2);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DESERT_S_DUE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DESERT_S_DUE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DESERT_S_DUE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = collected('Grizzly Bears', 0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
