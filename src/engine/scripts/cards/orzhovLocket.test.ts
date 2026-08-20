// `Orzhov Locket` — the hybrid sacrifice-draw-two, paid in white.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ORZHOV_LOCKET_SCRIPT } from './orzhovLocket';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function locketed(): { g: Game; locket: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Orzhov Locket'], []],
    scripts: createRegistry([ORZHOV_LOCKET_SCRIPT]),
  });
  const locket = put(g, 'p1', 'Orzhov Locket');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
  return { g, locket };
}

describe('Orzhov Locket', () => {
  test('the sacrifice-draw pays and draws two', () => {
    const { g, locket } = locketed();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[locket]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
  });

  test('replays to the same hash', () => {
    const { g, locket } = locketed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
