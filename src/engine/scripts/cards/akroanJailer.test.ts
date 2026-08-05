// `Akroan Jailer` — a targeted activated tap through the real intent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AKROAN_JAILER_SCRIPT } from './akroanJailer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const JAILER = 'Akroan Jailer';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[JAILER], ['Grizzly Bears']],
    scripts: createRegistry([AKROAN_JAILER_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Akroan Jailer', () => {
  test('taps the targeted creature', () => {
    const g = game();
    const jailer = put(g, 'p1', JAILER);
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: jailer,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[jailer]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = game();
    const jailer = put(g, 'p1', JAILER);
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: jailer,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
