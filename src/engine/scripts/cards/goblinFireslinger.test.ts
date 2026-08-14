// `Goblin Fireslinger` — the tap-ping at a player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_FIRESLINGER_SCRIPT } from './goblinFireslinger';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FIRESLINGER = 'Goblin Fireslinger';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; slinger: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FIRESLINGER], []],
    scripts: createRegistry([GOBLIN_FIRESLINGER_SCRIPT]),
  });
  const slinger = put(g, 'p1', FIRESLINGER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, slinger };
}

describe('Goblin Fireslinger', () => {
  test('taps to deal 1 to a player', () => {
    const { g, slinger } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: slinger,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players.p2?.life).toBe(39);
    expect(g.state.cards[slinger]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, slinger } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: slinger,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
