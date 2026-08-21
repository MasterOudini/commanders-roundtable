// `Rubblebelt Boar` — entering pumps the chosen creature +2/+0 and
// cleanup ends it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { RUBBLEBELT_BOAR_SCRIPT } from './rubblebeltBoar';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function boared(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rubblebelt Boar', 'Grizzly Bears'], []],
    scripts: createRegistry([RUBBLEBELT_BOAR_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Rubblebelt Boar');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Rubblebelt Boar', () => {
  test('the chosen creature reads +2/+0 and cleanup ends it', () => {
    const { g, bears } = boared();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(4);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = boared();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
