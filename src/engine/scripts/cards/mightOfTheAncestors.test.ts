// `Might of the Ancestors` — my begin-combat asks; the answer is +2/+0 and
// derived vigilance until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MIGHT_OF_THE_ANCESTORS_SCRIPT } from './mightOfTheAncestors';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blessed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Might of the Ancestors', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([MIGHT_OF_THE_ANCESTORS_SCRIPT]),
  });
  put(g, 'p1', 'Might of the Ancestors');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Might of the Ancestors', () => {
  test('the answer is +2/+0 and vigilance, gone by next turn', () => {
    const { g, bears } = blessed();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(2);
    expect(d.keywords.has('vigilance')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const later = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(later.power).toBe(2);
    expect(later.keywords.has('vigilance')).toBe(false);
  });

  test("the OPPONENT's combat pays nothing", () => {
    const g = startedGame({
      players: 2,
      decks: [['Grizzly Bears'], ['Might of the Ancestors', 'Grizzly Bears']],
      scripts: createRegistry([MIGHT_OF_THE_ANCESTORS_SCRIPT]),
    });
    put(g, 'p2', 'Might of the Ancestors');
    put(g, 'p2', 'Grizzly Bears');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(g.state.turn.turnNumber).toBeGreaterThanOrEqual(2);
  });

  test('replays to the same hash', () => {
    const { g } = blessed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
