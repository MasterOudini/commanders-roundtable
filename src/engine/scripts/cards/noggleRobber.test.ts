// `Noggle Robber` — entering pays a Treasure and dying pays another.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NOGGLE_ROBBER_SCRIPT } from './noggleRobber';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasures(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Treasure';
  }).length;
}

function robbed(): { g: Game; noggle: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Noggle Robber'], []],
    scripts: createRegistry([NOGGLE_ROBBER_SCRIPT]),
  });
  const noggle = put(g, 'p1', 'Noggle Robber');
  settle(g);
  return { g, noggle };
}

describe('Noggle Robber', () => {
  test('entering pays one Treasure; dying pays another', () => {
    const { g, noggle } = robbed();
    expect(treasures(g)).toBe(1);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: noggle,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(treasures(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, noggle } = robbed();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: noggle,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
