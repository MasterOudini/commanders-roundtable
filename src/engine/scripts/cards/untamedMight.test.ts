// `Untamed Might` — +X/+X, with X=0 a true no-op.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNTAMED_MIGHT_SCRIPT } from './untamedMight';
import { UNTAMED_MIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Untamed Might';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumped(x: number): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], []],
    scripts: createRegistry([UNTAMED_MIGHT_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: x + 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: x }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Untamed Might', () => {
  test('X=3 makes a 2/2 into a 5/5', () => {
    const { g, bears } = pumped(3);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(5);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(5);
  });

  test('X=0 is a true no-op', () => {
    const { g, bears } = pumped(0);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNTAMED_MIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNTAMED_MIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNTAMED_MIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = pumped(2);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
