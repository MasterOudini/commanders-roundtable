// `Magnify` — both sides' creatures read +1/+1 for the turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MAGNIFY_SCRIPT } from './magnify';
import { MAGNIFY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function magnified(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Magnify', 'Elvish Herder'], ['Grizzly Bears']],
    scripts: createRegistry([MAGNIFY_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Elvish Herder');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Magnify', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('Magnify', () => {
  test('both sides read +1/+1, and cleanup ends it', () => {
    const { g, mine, theirs } = magnified();
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(2);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(3);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MAGNIFY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MAGNIFY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MAGNIFY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = magnified();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
