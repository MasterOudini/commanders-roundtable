// `Succumb to Temptation` — two cards in, two life out.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUCCUMB_TO_TEMPTATION_SCRIPT } from './succumbToTemptation';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function succumbed(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Succumb to Temptation'], []],
    scripts: createRegistry([SUCCUMB_TO_TEMPTATION_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Succumb to Temptation', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, before };
}

describe('Succumb to Temptation', () => {
  test('two draws and two life', () => {
    const { g, before } = succumbed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before - 1 + 2);
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g } = succumbed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
