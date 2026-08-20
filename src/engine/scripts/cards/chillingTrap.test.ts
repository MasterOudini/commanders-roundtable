// `Chilling Trap` — the debuff plus the Wizard-gated draw, both branches.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CHILLING_TRAP_SCRIPT } from './chillingTrap';
import { CHILLING_TRAP } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function trapped(wizard: boolean): { g: Game; maw: InstanceId; before: number } {
  const g = startedGame({
    players: 2,
    // Caller of Gales is a Merfolk WIZARD.
    decks: [['Chilling Trap', 'Caller of Gales'], ['Colossal Dreadmaw']],
    scripts: createRegistry([CHILLING_TRAP_SCRIPT]),
  });
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  if (wizard) put(g, 'p1', 'Caller of Gales');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Chilling Trap', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
  settle(g);
  return { g, maw, before };
}

describe('Chilling Trap', () => {
  test('with a Wizard: the 6/6 reads 2/6 and a card is drawn', () => {
    const { g, maw, before } = trapped(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(2);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('without a Wizard: the debuff alone', () => {
    const { g, maw, before } = trapped(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(2);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CHILLING_TRAP.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CHILLING_TRAP.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CHILLING_TRAP.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = trapped(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
