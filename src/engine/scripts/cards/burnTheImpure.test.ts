// `Burn the Impure` — 3 to the creature; the infect rider hits its
// controller only when the DERIVED keyword is there.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BURN_THE_IMPURE_SCRIPT } from './burnTheImpure';
import { BURN_THE_IMPURE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burned(): { g: Game; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Burn the Impure'], ['Colossal Dreadmaw']],
    scripts: createRegistry([BURN_THE_IMPURE_SCRIPT]),
  });
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Burn the Impure', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
  settle(g);
  return { g, maw };
}

describe('Burn the Impure', () => {
  test('no infect: 3 marked, the controller untouched', () => {
    const { g, maw } = burned();
    expect(g.state.cards[maw]?.damage).toBe(3);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BURN_THE_IMPURE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BURN_THE_IMPURE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BURN_THE_IMPURE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = burned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
