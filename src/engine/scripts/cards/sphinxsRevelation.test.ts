// `Sphinx's Revelation` — X=3: gain 3, draw 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPHINXS_REVELATION_SCRIPT } from './sphinxsRevelation';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function revealed(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [["Sphinx's Revelation"], []],
    scripts: createRegistry([SPHINXS_REVELATION_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Sphinx's Revelation", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  settle(g);
  return { g, before };
}

describe("Sphinx's Revelation", () => {
  test('X=3 gains 3 and draws 3', () => {
    const { g, before } = revealed();
    expect(g.state.players['p1']?.life).toBe(43);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before - 1 + 3);
  });

  test('replays to the same hash', () => {
    const { g } = revealed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
