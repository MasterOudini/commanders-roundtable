// `Nighthawk, Dark Defender` — its own entry asks; a Hero entering asks; a
// non-Hero pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NIGHTHAWK_DARK_DEFENDER_SCRIPT } from './nighthawkDarkDefender';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hawked(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Nighthawk, Dark Defender', 'Grizzly Bears'], []],
    scripts: createRegistry([NIGHTHAWK_DARK_DEFENDER_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Nighthawk, Dark Defender');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Nighthawk, Dark Defender', () => {
  test('its own entry pumps the Bears; a non-Hero entry pays nothing', () => {
    const { g, bears } = hawked();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.toughness).toBe(3);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseTargets');
  });

  test('replays to the same hash', () => {
    const { g } = hawked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
