// `Great Defender` — +0/+X off the target's own mana value: the 6-drop
// 6/6 reads 6/12 for the turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GREAT_DEFENDER_SCRIPT } from './greatDefender';
import { GREAT_DEFENDER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function defended(): { g: Game; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Great Defender', 'Colossal Dreadmaw'], ['Grizzly Bears']],
    scripts: createRegistry([GREAT_DEFENDER_SCRIPT]),
  });
  const dreadmaw = put(g, 'p1', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Great Defender', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dreadmaw }] }));
  settle(g);
  return { g, dreadmaw };
}

describe('Great Defender', () => {
  test('X is the mana value: the 6/6 reads 6/12, and cleanup ends it', () => {
    const { g, dreadmaw } = defended();
    const d = derive(g.state, ORACLE, g.deps.scripts, dreadmaw);
    expect(d.power).toBe(6);
    expect(d.toughness).toBe(12);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, dreadmaw).toughness).toBe(6);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GREAT_DEFENDER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GREAT_DEFENDER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GREAT_DEFENDER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = defended();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
