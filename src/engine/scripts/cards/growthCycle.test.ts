// `Growth Cycle` — one namesake in the graveyard makes the pump +5/+5.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GROWTH_CYCLE_SCRIPT } from './growthCycle';
import { GROWTH_CYCLE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cycled(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Growth Cycle', 'Growth Cycle', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([GROWTH_CYCLE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Growth Cycle', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Growth Cycle', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Growth Cycle', () => {
  test('base +3/+3 plus +2/+2 for the buried copy: the 2/2 reads 7/7', () => {
    const { g, bears } = cycled();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(7);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GROWTH_CYCLE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GROWTH_CYCLE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GROWTH_CYCLE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cycled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
