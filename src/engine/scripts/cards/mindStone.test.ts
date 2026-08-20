// `Mind Stone` — the sacrifice-draw: the Stone pays itself into the
// graveyard and the card arrives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MIND_STONE_SCRIPT } from './mindStone';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stoned(): { g: Game; stone: InstanceId; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Mind Stone'], []],
    scripts: createRegistry([MIND_STONE_SCRIPT]),
  });
  const stone = put(g, 'p1', 'Mind Stone');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  return { g, stone, mid };
}

describe('Mind Stone', () => {
  test('the sacrifice pays and the draw lands', () => {
    const { g, stone, mid } = stoned();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: stone, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[stone]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, stone } = stoned();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: stone, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
