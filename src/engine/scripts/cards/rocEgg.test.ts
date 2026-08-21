// `Roc Egg` — dying hatches the 3/3 Bird.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROC_EGG_SCRIPT } from './rocEgg';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function hatched(): { g: Game; egg: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Roc Egg'], []],
    scripts: createRegistry([ROC_EGG_SCRIPT]),
  });
  const egg = put(g, 'p1', 'Roc Egg');
  settle(g);
  return { g, egg };
}

describe('Roc Egg', () => {
  test('dying hatches one Bird token', () => {
    const { g, egg } = hatched();
    expect(tokens(g)).toBe(0);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: egg,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(tokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, egg } = hatched();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: egg,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
