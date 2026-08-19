// `Accelerated Mutation` — X is the greatest mana value among the CASTER's
// permanents at resolution: a Dreadmaw (6) on my side makes the Bears 8/8.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ACCELERATED_MUTATION_SCRIPT } from './acceleratedMutation';
import { ACCELERATED_MUTATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Accelerated Mutation', 'Colossal Dreadmaw', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ACCELERATED_MUTATION_SCRIPT]),
  });
  put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Accelerated Mutation', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Accelerated Mutation', () => {
  test('X is the greatest mana value among MY permanents — the Dreadmaw makes it 6', () => {
    const { g, bears } = cast();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(8);
    expect(d.toughness).toBe(8);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ACCELERATED_MUTATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ACCELERATED_MUTATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ACCELERATED_MUTATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
