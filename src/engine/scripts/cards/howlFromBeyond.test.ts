// `Howl from Beyond` — X = 3 makes the 2/2 a 5/2 for the turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HOWL_FROM_BEYOND_SCRIPT } from './howlFromBeyond';
import { HOWL_FROM_BEYOND } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function howled(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Howl from Beyond', 'Grizzly Bears'], []],
    scripts: createRegistry([HOWL_FROM_BEYOND_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Howl from Beyond', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Howl from Beyond', () => {
  test('X = 3: the 2/2 reads 5/2, and cleanup ends it', () => {
    const { g, bears } = howled();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(5);
    expect(d.toughness).toBe(2);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HOWL_FROM_BEYOND.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HOWL_FROM_BEYOND.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HOWL_FROM_BEYOND.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = howled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
