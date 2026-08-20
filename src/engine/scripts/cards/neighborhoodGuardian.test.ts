// `Neighborhood Guardian` — a 1/1 entering asks; a 6/6 entering pays
// nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NEIGHBORHOOD_GUARDIAN_SCRIPT } from './neighborhoodGuardian';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function guarded(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Neighborhood Guardian', 'Aysen Bureaucrats', 'Grave Titan'], []],
    scripts: createRegistry([NEIGHBORHOOD_GUARDIAN_SCRIPT]),
  });
  put(g, 'p1', 'Neighborhood Guardian');
  settle(g);
  holdEverywhere(g);
  return g;
}

describe('Neighborhood Guardian', () => {
  test('a 1/1 entering asks and the pump lands ON IT; a 6/6 pays nothing', () => {
    const g = guarded();
    const clerk = put(g, 'p1', 'Aysen Bureaucrats');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: clerk }] }));
    settle(g);
    const d = derive(g.state, ORACLE, g.deps.scripts, clerk);
    expect(d.power).toBe(2);
    expect(d.toughness).toBe(2);
    put(g, 'p1', 'Grave Titan');
    settle(g);
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseTargets');
  });

  test('replays to the same hash', () => {
    const g = guarded();
    const clerk = put(g, 'p1', 'Aysen Bureaucrats');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: clerk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
