// `Fume Spitter` — the mana-free self-sacrifice: the Spitter dies, the
// target carries the -1/-1 counter.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FUME_SPITTER_SCRIPT } from './fumeSpitter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPITTER = 'Fume Spitter';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; spitter: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPITTER], [BEARS]],
    scripts: createRegistry([FUME_SPITTER_SCRIPT]),
  });
  const spitter = put(g, 'p1', SPITTER);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  return { g, spitter, bears };
}

describe('Fume Spitter', () => {
  test('sacrifices itself — no mana — and the target carries the counter', () => {
    const { g, spitter, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: spitter,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[spitter]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.counters['-1/-1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, spitter, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: spitter,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
