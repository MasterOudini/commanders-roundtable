// `Gaea's Might` — a Swamp and a Mountain make Domain 2: the 2/2 reads
// 4/4, and cleanup ends it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GAEAS_MIGHT_SCRIPT } from './gaeasMight';
import { GAEA_S_MIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mighted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Gaea's Might", 'Swamp', 'Mountain', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([GAEAS_MIGHT_SCRIPT]),
  });
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Mountain');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Gaea's Might", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe("Gaea's Might", () => {
  test('Domain 2 makes the 2/2 read 4/4; cleanup ends it', () => {
    const { g, bears } = mighted();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(4);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GAEA_S_MIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GAEA_S_MIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GAEA_S_MIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = mighted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
