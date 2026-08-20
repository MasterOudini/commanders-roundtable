// `Blood Mist` — an ENCHANTMENT's begin-combat targeted trigger: MY combat
// asks and grants derived double strike; the OPPONENT's combat pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLOOD_MIST_SCRIPT } from './bloodMist';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Blood Mist', () => {
  test('MY begin-combat asks; the grant is derived double strike until cleanup', () => {
    const g = startedGame({
      players: 2,
      decks: [['Blood Mist', 'Grizzly Bears'], ['Grizzly Bears']],
      scripts: createRegistry([BLOOD_MIST_SCRIPT]),
    });
    put(g, 'p1', 'Blood Mist');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('doubleStrike')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('doubleStrike')).toBe(false);
  });

  test("the OPPONENT's combat pays nothing", () => {
    const g = startedGame({
      players: 2,
      decks: [['Grizzly Bears'], ['Blood Mist', 'Grizzly Bears']],
      scripts: createRegistry([BLOOD_MIST_SCRIPT]),
    });
    // p2 controls the Mist; p1 is the active player on turn 1 — p1's combat
    // must raise NO prompt from p2's enchantment.
    put(g, 'p2', 'Blood Mist');
    put(g, 'p2', 'Grizzly Bears');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    // Turn 1 (p1's) passed clean through beginCombat with no wedge — reaching
    // turn 2 IS the assertion (an unanswered prompt would have stalled it).
    expect(g.state.turn.turnNumber).toBeGreaterThanOrEqual(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Blood Mist', 'Grizzly Bears'], ['Grizzly Bears']],
      scripts: createRegistry([BLOOD_MIST_SCRIPT]),
    });
    put(g, 'p1', 'Blood Mist');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
