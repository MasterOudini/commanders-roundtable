// `Shore Keeper` — {7}{U}, {T} and itself pay three draws, past its
// summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHORE_KEEPER_SCRIPT } from './shoreKeeper';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kept(): { g: Game; keeper: InstanceId; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Shore Keeper'], []],
    scripts: createRegistry([SHORE_KEEPER_SCRIPT]),
  });
  const keeper = put(g, 'p1', 'Shore Keeper');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: keeper, abilityIndex: 0 }));
  settle(g);
  return { g, keeper, mid };
}

describe('Shore Keeper', () => {
  test('the Keeper pays itself and three draws arrive', () => {
    const { g, keeper, mid } = kept();
    expect(g.state.cards[keeper]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 3);
  });

  test('replays to the same hash', () => {
    const { g } = kept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
