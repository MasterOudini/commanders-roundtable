// `Open the Graves` — a nontoken death pays a Zombie; the Zombie's own
// death pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OPEN_THE_GRAVES_SCRIPT } from './openTheGraves';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function zombies(g: Game): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Zombie';
  });
}

function graved(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Open the Graves', 'Grizzly Bears'], []],
    scripts: createRegistry([OPEN_THE_GRAVES_SCRIPT]),
  });
  put(g, 'p1', 'Open the Graves');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  return { g, bears };
}

describe('Open the Graves', () => {
  test("a nontoken death pays a Zombie; the Zombie's death pays nothing", () => {
    const { g, bears } = graved();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    const made = zombies(g);
    expect(made).toHaveLength(1);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: made[0] as InstanceId,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(zombies(g)).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const { g, bears } = graved();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
