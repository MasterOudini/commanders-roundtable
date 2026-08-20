// `Arborea Pegasus` — the targeted ETB grant with a pump AND a keyword on
// one entry: the target flies as a 3/3 until cleanup takes both back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARBOREA_PEGASUS_SCRIPT } from './arboreaPegasus';
import { derive } from '../../derive';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Arborea Pegasus', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ARBOREA_PEGASUS_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  put(g, 'p1', 'Arborea Pegasus');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Arborea Pegasus', () => {
  test('the target is a FLYING 3/3', () => {
    const { g, bears } = granted();
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.toughness).toBe(3);
    expect(d.keywords.has('flying')).toBe(true);
  });

  test('cleanup takes the pump AND the keyword back', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, bears);
    expect(d.power).toBe(2);
    expect(d.keywords.has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
