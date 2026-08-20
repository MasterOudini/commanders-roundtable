// `Hysterical Blindness` — THEIR creatures lose the power; mine keep it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HYSTERICAL_BLINDNESS_SCRIPT } from './hystericalBlindness';
import { HYSTERICAL_BLINDNESS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blinded(): { g: Game; theirs: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hysterical Blindness', 'Grizzly Bears'], ['Colossal Dreadmaw']],
    scripts: createRegistry([HYSTERICAL_BLINDNESS_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hysterical Blindness', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, theirs, mine };
}

describe('Hysterical Blindness', () => {
  test('their 6/6 reads 2/6; my 2/2 is untouched', () => {
    const { g, theirs, mine } = blinded();
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(2);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HYSTERICAL_BLINDNESS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HYSTERICAL_BLINDNESS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HYSTERICAL_BLINDNESS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = blinded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
