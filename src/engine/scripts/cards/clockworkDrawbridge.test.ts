// `Clockwork Drawbridge` — the tap behind defender, past sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CLOCKWORK_DRAWBRIDGE_SCRIPT } from './clockworkDrawbridge';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DRAWBRIDGE = 'Clockwork Drawbridge';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; wall: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DRAWBRIDGE], ['Grizzly Bears']],
    scripts: createRegistry([CLOCKWORK_DRAWBRIDGE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const wall = put(g, 'p1', DRAWBRIDGE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, wall, bears };
}

describe('Clockwork Drawbridge', () => {
  test('taps the targeted creature', () => {
    const { g, wall, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: wall,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, wall, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: wall,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
