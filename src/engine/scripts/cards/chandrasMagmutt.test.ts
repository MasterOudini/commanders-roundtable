// `Chandra's Magmutt` — the tap-ping, past summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CHANDRAS_MAGMUTT_SCRIPT } from './chandrasMagmutt';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGMUTT = "Chandra's Magmutt";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; dog: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGMUTT], []],
    scripts: createRegistry([CHANDRAS_MAGMUTT_SCRIPT]),
  });
  const dog = put(g, 'p1', MAGMUTT);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, dog };
}

describe("Chandra's Magmutt", () => {
  test('pings the targeted player for 1, the Magmutt turned by the cost', () => {
    const { g, dog } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: dog,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[dog]?.tapped).toBe(true);
    expect(g.log.some((e) => e.body.t === 'DamageDealt')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, dog } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: dog,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
