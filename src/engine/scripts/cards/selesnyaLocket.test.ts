// `Selesnya Locket` — the hybrid-priced self-sac draw-two at #a1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SELESNYA_LOCKET_SCRIPT } from './selesnyaLocket';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function locketed(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Selesnya Locket'], []],
    scripts: createRegistry([SELESNYA_LOCKET_SCRIPT]),
  });
  const locket = put(g, 'p1', 'Selesnya Locket');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1 }));
  settle(g);
  return { g, mid };
}

describe('Selesnya Locket', () => {
  test('all-green pays the hybrids and two draws arrive', () => {
    const { g, mid } = locketed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = locketed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
