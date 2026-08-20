// `Network Disruptor` — the entry taps a LAND (any permanent legal).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NETWORK_DISRUPTOR_SCRIPT } from './networkDisruptor';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function disrupted(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Network Disruptor'], ['Mountain']],
    scripts: createRegistry([NETWORK_DISRUPTOR_SCRIPT]),
  });
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Network Disruptor');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
  settle(g);
  return { g, land };
}

describe('Network Disruptor', () => {
  test('the entry taps the targeted land', () => {
    const { g, land } = disrupted();
    expect(g.state.cards[land]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = disrupted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
