// `Search Warrant` — the hand goes public and the count is the gain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEARCH_WARRANT_SCRIPT } from './searchWarrant';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function warranted(): { g: Game; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [['Search Warrant'], []],
    scripts: createRegistry([SEARCH_WARRANT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  const spell = put(g, 'p1', 'Search Warrant', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirs };
}

describe('Search Warrant', () => {
  test('gains one per card in the revealed hand', () => {
    const { g, theirs } = warranted();
    expect(g.state.players['p1']?.life).toBe(40 + theirs);
  });

  test('replays to the same hash', () => {
    const { g } = warranted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
