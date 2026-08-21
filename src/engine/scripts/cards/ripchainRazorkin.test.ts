// `Ripchain Razorkin` — a land pays the cost and the draw arrives; the
// cost has no {T}, so summoning sickness never enters into it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RIPCHAIN_RAZORKIN_SCRIPT } from './ripchainRazorkin';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Ripchain Razorkin', 'Mountain'], []],
    scripts: createRegistry([RIPCHAIN_RAZORKIN_SCRIPT]),
  });
  const razorkin = put(g, 'p1', 'Ripchain Razorkin');
  const mountain = put(g, 'p1', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: razorkin,
      abilityIndex: 0,
      sacrifice: mountain,
    }),
  );
  settle(g);
  return { g, mid };
}

describe('Ripchain Razorkin', () => {
  test('the land dies and the draw arrives', () => {
    const { g, mid } = drawn();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = drawn();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
