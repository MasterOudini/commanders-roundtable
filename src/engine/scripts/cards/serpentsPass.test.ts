// `Serpent's Pass` — enters tapped; {4}, {T} and itself pay a draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SERPENTS_PASS_SCRIPT } from './serpentsPass';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function passed(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [["Serpent's Pass"], []],
    scripts: createRegistry([SERPENTS_PASS_SCRIPT]),
  });
  const pass = put(g, 'p1', "Serpent's Pass");
  settle(g);
  expect(g.state.cards[pass]?.tapped).toBe(true);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [pass], tapped: false }));
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pass, abilityIndex: 1 }));
  settle(g);
  return { g, mid };
}

describe("Serpent's Pass", () => {
  test('the land pays itself and the draw arrives', () => {
    const { g, mid } = passed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = passed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
