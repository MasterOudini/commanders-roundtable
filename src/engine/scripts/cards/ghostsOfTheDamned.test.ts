// `Ghosts of the Damned` — the tap-cost -1/-0 debuff, Ghost Warden's mirror.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GHOSTS_OF_THE_DAMNED_SCRIPT } from './ghostsOfTheDamned';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GHOSTS = 'Ghosts of the Damned';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function debuffs(g: Game, card: InstanceId): number {
  return g.log.filter(
    (e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === card && e.body.power === -1,
  ).length;
}

function board(): { g: Game; ghosts: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GHOSTS], [BEARS]],
    scripts: createRegistry([GHOSTS_OF_THE_DAMNED_SCRIPT]),
  });
  const ghosts = put(g, 'p1', GHOSTS);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, ghosts, bears };
}

describe('Ghosts of the Damned', () => {
  test('taps to give the target -1/-0', () => {
    const { g, ghosts, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: ghosts,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(debuffs(g, bears)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, ghosts, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: ghosts,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
