// `Unleash Shell` — 5 at the permanent and 2 at its CONTROLLER, on both arms
// of the compound.
//
// ⚠️ Damage to a planeswalker is only MARKED in this engine (D257), so the
// planeswalker case asserts `damage` and never a loyalty delta.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNLEASH_SHELL_SCRIPT } from './unleashShell';
import { UNLEASH_SHELL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Unleash Shell';
const TITAN = 'Grave Titan'; // 6/6 — survives 5
const WALKER = 'Grist, the Hunger Tide';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [victimName]],
    scripts: createRegistry([UNLEASH_SHELL_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Unleash Shell', () => {
  test('a CREATURE takes 5 and its controller takes 2', () => {
    const { g, victim } = fired(TITAN);
    expect(g.state.cards[victim]?.damage).toBe(5);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p2?.life).toBe(38);
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('a PLANESWALKER is the other arm — damage is MARKED, not loyalty (D257)', () => {
    const { g, victim } = fired(WALKER);
    expect(g.state.cards[victim]?.damage).toBe(5);
    expect(g.state.players.p2?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNLEASH_SHELL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNLEASH_SHELL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNLEASH_SHELL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fired(TITAN);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
