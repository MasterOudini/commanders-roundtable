// `Double Trouble` — the 2/2 reads 4 and the 6/6 reads 12; the opponent's
// creature is untouched, and cleanup ends it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DOUBLE_TROUBLE_SCRIPT } from './doubleTrouble';
import { DOUBLE_TROUBLE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function doubled(): { g: Game; bears: InstanceId; maw: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Double Trouble', 'Grizzly Bears', 'Colossal Dreadmaw'], ['Grizzly Bears']],
    scripts: createRegistry([DOUBLE_TROUBLE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Double Trouble', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw, theirs };
}

describe('Double Trouble', () => {
  test('my 2/2 reads 4 and my 6/6 reads 12; the opponent stays 2 — and cleanup ends it', () => {
    const { g, bears, maw, theirs } = doubled();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(12);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(2);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DOUBLE_TROUBLE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DOUBLE_TROUBLE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DOUBLE_TROUBLE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = doubled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
