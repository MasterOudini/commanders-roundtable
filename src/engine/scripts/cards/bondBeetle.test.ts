// `Bond Beetle` — the ETB +1/+1, on whichever creature is chosen.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOND_BEETLE_SCRIPT } from './bondBeetle';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BEETLE = 'Bond Beetle';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BEETLE, 'Grizzly Bears'], []],
    scripts: createRegistry([BOND_BEETLE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  const beetle = put(g, 'p1', BEETLE, 'graveyard');
  settle(g);
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: beetle, to: { kind: 'battlefield', player: 'p1' } }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Bond Beetle', () => {
  test('entering puts a +1/+1 counter on the chosen creature', () => {
    const { g, bears } = board();
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
