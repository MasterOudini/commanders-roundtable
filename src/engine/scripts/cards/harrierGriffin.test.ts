// `Harrier Griffin` — MY upkeep asks for a creature and taps it; the prompt
// arrives on the controller's turn, which is the "your" in the printed line.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HARRIER_GRIFFIN_SCRIPT } from './harrierGriffin';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GRIFFIN = 'Harrier Griffin';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function prompted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GRIFFIN], [BEARS]],
    scripts: createRegistry([HARRIER_GRIFFIN_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  put(g, 'p1', GRIFFIN);
  settle(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears };
}

describe('Harrier Griffin', () => {
  test('the prompt comes on MY upkeep and the answer taps the creature', () => {
    const { g, bears } = prompted();
    // "your upkeep" — the first prompt of the game is on the controller's turn.
    expect(g.state.turn.activePlayer).toBe('p1');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, bears } = prompted();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
