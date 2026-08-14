// `Ghost Warden` — the tap-cost +1/+1 pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GHOST_WARDEN_SCRIPT } from './ghostWarden';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WARDEN = 'Ghost Warden';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumps(g: Game, card: InstanceId): number {
  return g.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === card).length;
}

function board(): { g: Game; warden: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WARDEN, BEARS], []],
    scripts: createRegistry([GHOST_WARDEN_SCRIPT]),
  });
  const warden = put(g, 'p1', WARDEN);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, warden, bears };
}

describe('Ghost Warden', () => {
  test('taps to pump the target +1/+1', () => {
    const { g, warden, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: warden,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(pumps(g, bears)).toBe(1);
    expect(g.state.cards[warden]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, warden, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: warden,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
