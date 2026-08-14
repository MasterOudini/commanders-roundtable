// `Gideon's Lawkeeper` — the third oracle id on Benalish Trapper's exact
// text, proven on its own.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GIDEONS_LAWKEEPER_SCRIPT } from './gideonsLawkeeper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LAWKEEPER = "Gideon's Lawkeeper";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; lawkeeper: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LAWKEEPER], [BEARS]],
    scripts: createRegistry([GIDEONS_LAWKEEPER_SCRIPT]),
  });
  const lawkeeper = put(g, 'p1', LAWKEEPER);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, lawkeeper, bears };
}

describe("Gideon's Lawkeeper", () => {
  test('taps the target creature', () => {
    const { g, lawkeeper, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: lawkeeper,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, lawkeeper, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: lawkeeper,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
