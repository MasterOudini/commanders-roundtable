// `Shadow Alley Denizen` — a black creature entering asks and the
// intimidate grant rides; a green creature entering asks nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { SHADOW_ALLEY_DENIZEN_SCRIPT } from './shadowAlleyDenizen';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function denizened(): { g: Game; denizen: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Shadow Alley Denizen', 'Rathi Trapper', 'Grizzly Bears'], []],
    scripts: createRegistry([SHADOW_ALLEY_DENIZEN_SCRIPT]),
  });
  const denizen = put(g, 'p1', 'Shadow Alley Denizen');
  settle(g);
  holdEverywhere(g);
  return { g, denizen };
}

describe('Shadow Alley Denizen', () => {
  test('a green entry asks nothing; a black entry grants intimidate', () => {
    const { g, denizen } = denizened();
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    put(g, 'p1', 'Rathi Trapper');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: denizen }] }));
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, denizen).keywords.has('intimidate')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, denizen).keywords.has('intimidate')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, denizen } = denizened();
    put(g, 'p1', 'Rathi Trapper');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: denizen }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
