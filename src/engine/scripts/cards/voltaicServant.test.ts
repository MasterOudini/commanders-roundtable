// `Voltaic Servant` — the untap arrives at MY end step and not the
// opponent's, which is the whole of "your end step".

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VOLTAIC_SERVANT_SCRIPT } from './voltaicServant';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SERVANT = 'Voltaic Servant';
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SERVANT, RING], []],
    scripts: createRegistry([VOLTAIC_SERVANT_SCRIPT]),
  });
  put(g, 'p1', SERVANT);
  const ring = put(g, 'p1', RING);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ring], tapped: true }));
  return { g, ring };
}

describe('Voltaic Servant', () => {
  test('my end step asks for a target and untaps it', () => {
    const { g, ring } = board();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[ring]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, ring } = board();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
