// `Vampire Envoy` — becomes-tapped pays, whatever tapped it: the Tier-3 tool
// and an attack both count, because `PermanentsTapped` covers every path.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VAMPIRE_ENVOY_SCRIPT } from './vampireEnvoy';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ENVOY = 'Vampire Envoy';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; envoy: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ENVOY, BEARS], []],
    scripts: createRegistry([VAMPIRE_ENVOY_SCRIPT]),
  });
  const envoy = put(g, 'p1', ENVOY);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, envoy, bears };
}

describe('Vampire Envoy', () => {
  test('tapping it gains 1; tapping something else gains nothing', () => {
    const { g, envoy, bears } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(40);

    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [envoy], tapped: true }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('UNTAPPING it pays nothing — the trigger is one-directional', () => {
    const { g, envoy } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [envoy], tapped: true }));
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [envoy], tapped: false }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g, envoy } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [envoy], tapped: true }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
