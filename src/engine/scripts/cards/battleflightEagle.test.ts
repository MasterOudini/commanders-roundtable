// `Battleflight Eagle` — Arborea Pegasus's targeted ETB grant at +2/+2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BATTLEFLIGHT_EAGLE_SCRIPT } from './battleflightEagle';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Battleflight Eagle', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BATTLEFLIGHT_EAGLE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  put(g, 'p1', 'Battleflight Eagle');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Battleflight Eagle', () => {
  test('the target is a FLYING 4/4 until cleanup', () => {
    const { g, bears } = granted();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(4);
    expect(d.keywords.has('flying')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const after = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(after.power).toBe(2);
    expect(after.keywords.has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
