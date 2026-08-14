// `Goldmeadow Harrier` — the FOURTH oracle id on the Benalish text, proven
// on its own.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOLDMEADOW_HARRIER_SCRIPT } from './goldmeadowHarrier';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HARRIER = 'Goldmeadow Harrier';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; harrier: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HARRIER], [BEARS]],
    scripts: createRegistry([GOLDMEADOW_HARRIER_SCRIPT]),
  });
  const harrier = put(g, 'p1', HARRIER);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, harrier, bears };
}

describe('Goldmeadow Harrier', () => {
  test('taps the target creature', () => {
    const { g, harrier, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: harrier,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, harrier, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: harrier,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
