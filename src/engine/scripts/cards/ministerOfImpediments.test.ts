// `Minister of Impediments` — the sixth id on the Trapper tap, free of a
// mana price: {T} alone turns the target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MINISTER_OF_IMPEDIMENTS_SCRIPT } from './ministerOfImpediments';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; minister: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Minister of Impediments'], ['Grizzly Bears']],
    scripts: createRegistry([MINISTER_OF_IMPEDIMENTS_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const minister = put(g, 'p1', 'Minister of Impediments');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, minister, bears };
}

describe('Minister of Impediments', () => {
  test('taps the targeted creature', () => {
    const { g, minister, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: minister,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[minister]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, minister, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: minister,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
