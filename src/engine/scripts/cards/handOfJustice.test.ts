// `Hand of Justice` — its own tap and three untapped WHITE creatures tapped
// destroy the opponent's creature; a green bear cannot be one of the three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HAND_OF_JUSTICE_SCRIPT } from './handOfJustice';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HAND = 'Hand of Justice';
const WHITES = ['Stern Constable', 'Thraben Standard Bearer', 'Cathedral Sanctifier'];
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; hand: InstanceId; whites: InstanceId[]; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HAND, ...WHITES, BEARS], [BEARS]],
    scripts: createRegistry([HAND_OF_JUSTICE_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const mine = put(g, 'p1', BEARS);
  const whites = WHITES.map((n) => put(g, 'p1', n));
  const hand = put(g, 'p1', HAND);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, hand, whites, mine, theirs };
}

describe('Hand of Justice (tap three white creatures)', () => {
  test('three white creatures tap; their bear is destroyed', () => {
    const { g, hand, whites, theirs } = ready();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hand, abilityIndex: 0, tap: whites }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[hand]?.tapped).toBe(true);
  });

  test('a green bear cannot pay', () => {
    const { g, hand, whites, mine } = ready();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: hand, abilityIndex: 0, tap: [whites[0] as InstanceId, whites[1] as InstanceId, mine] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, hand, whites, theirs } = ready();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hand, abilityIndex: 0, tap: whites }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
