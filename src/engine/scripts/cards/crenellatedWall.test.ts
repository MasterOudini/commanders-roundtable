// `Crenellated Wall` — a targeted {T} pump on an artifact CREATURE:
// summoning sickness gates the tap (CR 302.6 covers artifact creatures too),
// and the +0/+4 lands through the staged prompt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CRENELLATED_WALL_SCRIPT } from './crenellatedWall';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WALL = 'Crenellated Wall';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; wall: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WALL, BEARS], []],
    scripts: createRegistry([CRENELLATED_WALL_SCRIPT]),
  });
  const wall = put(g, 'p1', WALL);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 20_000);
  return { g, wall, bears };
}

describe('Crenellated Wall', () => {
  test('the tap pays, the prompt stages, and the target gets +0/+4', () => {
    const { g, wall, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: wall, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[wall]?.tapped).toBe(true);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.toughness === 4,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, wall, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: wall, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
