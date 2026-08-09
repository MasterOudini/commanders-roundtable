// `Friendly Ghost` — the +2/+4 lands as the layer-7c modifier.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FRIENDLY_GHOST_SCRIPT } from './friendlyGhost';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GHOST = 'Friendly Ghost';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entering(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GHOST, BEARS], []],
    scripts: createRegistry([FRIENDLY_GHOST_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  put(g, 'p1', GHOST);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears };
}

describe('Friendly Ghost', () => {
  test('the +2/+4 lands on the aim', () => {
    const { g, bears } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === bears &&
          e.body.power === 2 &&
          e.body.toughness === 4,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, bears } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
