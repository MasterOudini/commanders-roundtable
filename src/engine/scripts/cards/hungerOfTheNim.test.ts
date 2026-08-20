// `Hunger of the Nim` — two artifacts make it +2/+0.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HUNGER_OF_THE_NIM_SCRIPT } from './hungerOfTheNim';
import { HUNGER_OF_THE_NIM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hungered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hunger of the Nim', 'Grizzly Bears', 'Sol Ring', 'Azorius Locket'], []],
    scripts: createRegistry([HUNGER_OF_THE_NIM_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Sol Ring');
  put(g, 'p1', 'Azorius Locket');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hunger of the Nim', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Hunger of the Nim', () => {
  test('two artifacts: the 2/2 reads 4/2, and cleanup ends it', () => {
    const { g, bears } = hungered();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(4);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HUNGER_OF_THE_NIM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HUNGER_OF_THE_NIM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HUNGER_OF_THE_NIM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = hungered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
