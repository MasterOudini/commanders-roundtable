// `Myr Sire` — dying leaves a 1/1 Phyrexian Myr behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MYR_SIRE_SCRIPT } from './myrSire';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sired(): { g: Game; sire: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Myr Sire'], []],
    scripts: createRegistry([MYR_SIRE_SCRIPT]),
  });
  const sire = put(g, 'p1', 'Myr Sire');
  settle(g);
  return { g, sire };
}

function myrTokens(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Phyrexian Myr';
  }).length;
}

describe('Myr Sire', () => {
  test('dying leaves a Myr; entering left nothing', () => {
    const { g, sire } = sired();
    expect(myrTokens(g)).toBe(0);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: sire,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(myrTokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, sire } = sired();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: sire,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
