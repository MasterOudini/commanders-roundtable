// `Orzhov Cluestone` — the sacrifice-draw pays and draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ORZHOV_CLUESTONE_SCRIPT } from './orzhovCluestone';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cluestoned(): { g: Game; stone: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Orzhov Cluestone'], []],
    scripts: createRegistry([ORZHOV_CLUESTONE_SCRIPT]),
  });
  const stone = put(g, 'p1', 'Orzhov Cluestone');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, stone };
}

describe('Orzhov Cluestone', () => {
  test('the sacrifice-draw pays and draws', () => {
    const { g, stone } = cluestoned();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: stone, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[stone]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, stone } = cluestoned();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: stone, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
