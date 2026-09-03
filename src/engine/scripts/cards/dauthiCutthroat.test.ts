// `Dauthi Cutthroat` — {1}{B}, {T} (turn 3) destroys their Cutthroat, a
// creature WITH SHADOW; a Bears is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DAUTHI_CUTTHROAT_SCRIPT } from './dauthiCutthroat';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Dauthi Cutthroat';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; self: InstanceId; theirs: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD], [CARD, BEARS]], scripts: createRegistry([DAUTHI_CUTTHROAT_SCRIPT]) });
  const self = put(g, 'p1', CARD);
  const theirs = put(g, 'p2', CARD);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, self, theirs, bears };
}

describe('Dauthi Cutthroat', () => {
  test('destroys the other shadow creature', () => {
    const { g, self, theirs } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('a creature without shadow is refused (D289)', () => {
    const { g, bears } = placed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
