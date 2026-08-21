// `Rush of Knowledge` — the greatest mana value among MY permanents
// decides the draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RUSH_OF_KNOWLEDGE_SCRIPT } from './rushOfKnowledge';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rushed(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rush of Knowledge', 'Colossal Dreadmaw', 'Sol Ring'],
      [],
    ],
    scripts: createRegistry([RUSH_OF_KNOWLEDGE_SCRIPT]),
  });
  put(g, 'p1', 'Colossal Dreadmaw');
  put(g, 'p1', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Rush of Knowledge', 'hand');
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mid };
}

describe('Rush of Knowledge', () => {
  test('draws six off the Dreadmaw', () => {
    const { g, mid } = rushed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid - 1 + 6);
  });

  test('replays to the same hash', () => {
    const { g } = rushed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
