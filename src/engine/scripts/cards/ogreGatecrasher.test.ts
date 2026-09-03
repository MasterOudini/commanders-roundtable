// `Ogre Gatecrasher` — entering destroys their defender (a Bamboo Grove
// Archer); a creature without defender is refused (D289).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OGRE_GATECRASHER_SCRIPT } from './ogreGatecrasher';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Ogre Gatecrasher';
const WALL = 'Bamboo Grove Archer';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; wall: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD], [WALL, BEARS]], scripts: createRegistry([OGRE_GATECRASHER_SCRIPT]) });
  const wall = put(g, 'p2', WALL);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  const ogre = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: ogre, to: { kind: 'battlefield', player: 'p1' } }));
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, wall, bears };
}

describe('Ogre Gatecrasher', () => {
  test('destroys the defender', () => {
    const { g, wall } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wall }] }));
    settle(g);
    expect(g.state.cards[wall]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
  });

  test('a creature without defender is refused (D289)', () => {
    const { g, bears } = entered();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, wall } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wall }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
