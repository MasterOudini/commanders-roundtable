// `Wall of Mulch` — the Wall it eats may be ANOTHER Wall or ITSELF, because
// "a Wall" is not "another". Wall of Runes is the other Wall, from this same
// batch.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WALL_OF_MULCH_SCRIPT } from './wallOfMulch';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MULCH = 'Wall of Mulch';
const RUNES = 'Wall of Runes';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mulch: InstanceId; runes: InstanceId; hand: number } {
  const g = startedGame({
    players: 2,
    decks: [[MULCH, RUNES], []],
    scripts: createRegistry([WALL_OF_MULCH_SCRIPT]),
  });
  const mulch = put(g, 'p1', MULCH);
  const runes = put(g, 'p1', RUNES);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  // ⚠️ The baseline goes BEHIND both puts, which moved cards out of my hand.
  const hand = (g.state.zones.hand['p1'] ?? []).length;
  return { g, mulch, runes, hand };
}

describe('Wall of Mulch', () => {
  test('eating the OTHER Wall draws a card', () => {
    const { g, mulch, runes, hand } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: mulch, abilityIndex: 0, sacrifice: runes }),
    );
    settle(g);
    expect(g.state.cards[runes]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mulch]?.zone.kind).toBe('battlefield');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(hand + 1);
  });

  test('it may eat ITSELF — "a Wall" is not "another"', () => {
    const { g, mulch, hand } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: mulch, abilityIndex: 0, sacrifice: mulch }),
    );
    settle(g);
    expect(g.state.cards[mulch]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(hand + 1);
  });

  test('replays to the same hash', () => {
    const { g, mulch, runes } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: mulch, abilityIndex: 0, sacrifice: runes }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
