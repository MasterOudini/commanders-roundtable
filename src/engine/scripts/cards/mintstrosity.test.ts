// `Mintstrosity` — dying bakes a Food.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MINTSTROSITY_SCRIPT } from './mintstrosity';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function minted(): { g: Game; horror: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mintstrosity'], []],
    scripts: createRegistry([MINTSTROSITY_SCRIPT]),
  });
  const horror = put(g, 'p1', 'Mintstrosity');
  settle(g);
  return { g, horror };
}

function foods(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    const oc = g.deps.oracle.byPrinting(card.printingId);
    return oc?.name === 'Food';
  }).length;
}

describe('Mintstrosity', () => {
  test('dying bakes a Food; entering baked nothing', () => {
    const { g, horror } = minted();
    expect(foods(g)).toBe(0);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: horror,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(foods(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, horror } = minted();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: horror,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
