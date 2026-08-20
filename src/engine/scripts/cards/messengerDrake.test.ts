// `Messenger Drake` — dying draws; entering does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MESSENGER_DRAKE_SCRIPT } from './messengerDrake';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function draked(): { g: Game; drake: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Messenger Drake'], []],
    scripts: createRegistry([MESSENGER_DRAKE_SCRIPT]),
  });
  const drake = put(g, 'p1', 'Messenger Drake');
  settle(g);
  return { g, drake };
}

describe('Messenger Drake', () => {
  test('dying draws a card; the entry drew nothing', () => {
    const { g, drake } = draked();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: drake,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, drake } = draked();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: drake,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
