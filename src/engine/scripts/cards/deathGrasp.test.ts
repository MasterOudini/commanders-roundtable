// `Death Grasp` — X at the opponent's face and X back to the caster.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEATH_GRASP_SCRIPT } from './deathGrasp';
import { DEATH_GRASP } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function grasped(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Death Grasp'], ['Grizzly Bears']],
    scripts: createRegistry([DEATH_GRASP_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Death Grasp', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Death Grasp', () => {
  test('X = 3 burns the target and heals the caster', () => {
    const { g } = grasped();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEATH_GRASP.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEATH_GRASP.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEATH_GRASP.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = grasped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
