// `Benalish Trapper` — the creature-tap, asserted on the EVENT.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BENALISH_TRAPPER_SCRIPT } from './benalishTrapper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TRAPPER = 'Benalish Trapper';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; trapper: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TRAPPER], ['Grizzly Bears']],
    scripts: createRegistry([BENALISH_TRAPPER_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const trapper = put(g, 'p1', TRAPPER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, trapper, bears };
}

describe('Benalish Trapper', () => {
  test('taps the targeted creature, asserted on the EVENT', () => {
    const { g, trapper, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: trapper,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(
      g.log.some((e) => e.body.t === 'PermanentsTapped' && e.body.cards.includes(bears)),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, trapper, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: trapper,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
