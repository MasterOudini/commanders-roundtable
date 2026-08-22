// `Temur Banner` — the fourth Banner: it eats ITSELF at #a1 for a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEMUR_BANNER_SCRIPT } from './temurBanner';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BANNER = 'Temur Banner';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hand(g: Game): number {
  return (g.state.zones.hand.p1 ?? []).length;
}

function game(): { g: Game; banner: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BANNER], []],
    scripts: createRegistry([TEMUR_BANNER_SCRIPT]),
  });
  const banner = put(g, 'p1', BANNER);
  settle(g);
  for (const symbol of ['G', 'U', 'R'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount: 1 }));
  }
  return { g, banner };
}

describe('Temur Banner', () => {
  test('it eats ITSELF for a card', () => {
    const { g, banner } = game();
    const before = hand(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: banner, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[banner]?.zone.kind).toBe('graveyard');
    expect(hand(g)).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, banner } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: banner, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
