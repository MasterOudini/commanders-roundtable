// `Exponential Growth` — X = 2 doubles the 2/2's power twice: 2 → 8, and
// cleanup ends it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EXPONENTIAL_GROWTH_SCRIPT } from './exponentialGrowth';
import { EXPONENTIAL_GROWTH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function grown(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Exponential Growth', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([EXPONENTIAL_GROWTH_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Exponential Growth', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Exponential Growth', () => {
  test('X = 2 doubles twice: 2 → 8, and cleanup ends it', () => {
    const { g, bears } = grown();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(8);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EXPONENTIAL_GROWTH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EXPONENTIAL_GROWTH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EXPONENTIAL_GROWTH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = grown();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
