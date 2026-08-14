// `Hyrax Tower Scout` — entering straightens a chosen tapped creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HYRAX_TOWER_SCOUT_SCRIPT } from './hyraxTowerScout';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SCOUT = 'Hyrax Tower Scout';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SCOUT, BEARS], []],
    scripts: createRegistry([HYRAX_TOWER_SCOUT_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
  put(g, 'p1', SCOUT);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Hyrax Tower Scout', () => {
  test('entering untaps the chosen creature', () => {
    const { g, bears } = answered();
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = answered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
