// `Satyr Grovedancer` — entering puts the counter where aimed.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SATYR_GROVEDANCER_SCRIPT } from './satyrGrovedancer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function danced(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Satyr Grovedancer', 'Grizzly Bears'], []],
    scripts: createRegistry([SATYR_GROVEDANCER_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Satyr Grovedancer');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Satyr Grovedancer', () => {
  test('the counter lands on the chosen creature', () => {
    const { g, bears } = danced();
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = danced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
