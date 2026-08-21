// `Scepter of Insight` — {3}{U}, {T} draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCEPTER_OF_INSIGHT_SCRIPT } from './scepterOfInsight';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scryed(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Scepter of Insight'], []],
    scripts: createRegistry([SCEPTER_OF_INSIGHT_SCRIPT]),
  });
  const scepter = put(g, 'p1', 'Scepter of Insight');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: scepter, abilityIndex: 0 }));
  settle(g);
  return { g, mid };
}

describe('Scepter of Insight', () => {
  test('the draw arrives', () => {
    const { g, mid } = scryed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g } = scryed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
