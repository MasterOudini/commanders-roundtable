// `Kavu Lair` - a 5/5 entering draws its controller a card, a 2/2 draws nothing; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KAVU_LAIR_SCRIPT } from './kavuLair';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Kavu Lair';
const BEARS = 'Grizzly Bears';
const REAPER = 'Dread Reaper'; // a 5/5 flier

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; big: InstanceId; small: InstanceId; hand0: number } {
  const g = startedGame({ players: 2, decks: [[CARD], [BEARS, REAPER]], scripts: createRegistry([KAVU_LAIR_SCRIPT]) });
  holdEverywhere(g);
  put(g, 'p1', CARD);
  const big = put(g, 'p2', REAPER, 'graveyard');
  const small = put(g, 'p2', BEARS, 'graveyard');
  settle(g);
  const hand0 = (g.state.zones.hand.p2 ?? []).length;
  return { g, big, small, hand0 };
}

describe('Kavu Lair', () => {
  test('a creature with power 4 or greater entering draws its controller a card', () => {
    const { g, big, hand0 } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: big, to: { kind: 'battlefield', player: 'p2' } }));
    settle(g);
    expect((g.state.zones.hand.p2 ?? []).length).toBe(hand0 + 1);
  });

  test('a smaller creature draws nothing', () => {
    const { g, small, hand0 } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: small, to: { kind: 'battlefield', player: 'p2' } }));
    settle(g);
    expect((g.state.zones.hand.p2 ?? []).length).toBe(hand0);
  });

  test('replays to the same hash', () => {
    const { g, big } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: big, to: { kind: 'battlefield', player: 'p2' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
