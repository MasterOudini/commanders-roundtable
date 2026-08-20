// `Ornery Kudu` — the entry puts a -1/-1 counter on my pick.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ORNERY_KUDU_SCRIPT } from './orneryKudu';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kudued(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Ornery Kudu', 'Grizzly Bears'], []],
    scripts: createRegistry([ORNERY_KUDU_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Ornery Kudu');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Ornery Kudu', () => {
  test('the entry puts a -1/-1 counter on my pick', () => {
    const { g, bears } = kudued();
    expect(g.state.cards[bears]?.counters['-1/-1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = kudued();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
