// `Akroan Mastiff` — Akroan Jailer's twin; the deep case lives there.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AKROAN_MASTIFF_SCRIPT } from './akroanMastiff';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MASTIFF = 'Akroan Mastiff';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Akroan Mastiff', () => {
  test('taps the target and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [[MASTIFF], ['Grizzly Bears']],
      scripts: createRegistry([AKROAN_MASTIFF_SCRIPT]),
    });
    const mastiff = put(g, 'p1', MASTIFF);
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: mastiff,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
