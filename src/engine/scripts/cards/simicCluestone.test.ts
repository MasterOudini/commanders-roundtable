// `Simic Cluestone` — the self-sac draw at #a1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SIMIC_CLUESTONE_SCRIPT } from './simicCluestone';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function clued(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Simic Cluestone'], []],
    scripts: createRegistry([SIMIC_CLUESTONE_SCRIPT]),
  });
  const stone = put(g, 'p1', 'Simic Cluestone');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: stone, abilityIndex: 1 }));
  settle(g);
  return { g, mid };
}

describe('Simic Cluestone', () => {
  test('the stone dies and the draw arrives', () => {
    const { g, mid } = clued();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = clued();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
