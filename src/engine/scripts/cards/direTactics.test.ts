// `Dire Tactics` — no Human: the exile costs the caster the toughness;
// with a Human on the caster's board it costs nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DIRE_TACTICS_SCRIPT } from './direTactics';
import { DIRE_TACTICS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function executed(withHuman: boolean): { g: Game; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dire Tactics', 'Angelheart Protector'], ['Colossal Dreadmaw']],
    scripts: createRegistry([DIRE_TACTICS_SCRIPT]),
  });
  if (withHuman) put(g, 'p1', 'Angelheart Protector');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Dire Tactics', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
  settle(g);
  return { g, maw };
}

describe('Dire Tactics', () => {
  test('no Human: the 6/6 is exiled and the caster pays 6', () => {
    const { g, maw } = executed(false);
    expect(g.state.cards[maw]?.zone.kind).toBe('exile');
    expect(g.state.players['p1']?.life).toBe(34);
  });

  test('with a Human the exile costs nothing', () => {
    const { g, maw } = executed(true);
    expect(g.state.cards[maw]?.zone.kind).toBe('exile');
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DIRE_TACTICS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DIRE_TACTICS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DIRE_TACTICS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = executed(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
