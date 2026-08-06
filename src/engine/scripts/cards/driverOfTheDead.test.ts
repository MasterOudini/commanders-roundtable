// `Driver of the Dead` — the dies-trigger reanimates mv ≤ 2 from MY
// graveyard; a bigger card is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRIVER_OF_THE_DEAD_SCRIPT } from './driverOfTheDead';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DRIVER = 'Driver of the Dead';
const SMALL = 'Grizzly Bears';
const BIG = 'Krenko, Mob Boss';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): { g: Game; bears: InstanceId; krenko: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DRIVER, SMALL, BIG], []],
    scripts: createRegistry([DRIVER_OF_THE_DEAD_SCRIPT]),
  });
  const driver = put(g, 'p1', DRIVER);
  const bears = put(g, 'p1', SMALL);
  const krenko = put(g, 'p1', BIG);
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: krenko, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: driver, to: { kind: 'graveyard', player: 'p1' } }));
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, bears, krenko };
}

describe('Driver of the Dead', () => {
  test('mv 2 comes back; mv 4 is refused at the aim (D139 on a trigger)', () => {
    const { g, bears, krenko } = died();
    const wrong = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: krenko }] });
    expect(wrong.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.controller).toBe('p1');
  });

  test('replays to the same hash', () => {
    const { g, bears } = died();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
