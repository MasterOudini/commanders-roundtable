// `Syphon Soul` — 2 to EACH other player and the gain is the total: at a
// three-seat table that is 4, not 2, which is what makes the fan worth
// counting rather than assuming.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SYPHON_SOUL_SCRIPT } from './syphonSoul';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function syphoned(players: number): Game {
  const decks: string[][] = [['Syphon Soul']];
  for (let i = 1; i < players; i++) decks.push([]);
  const g = startedGame({ players, decks, scripts: createRegistry([SYPHON_SOUL_SCRIPT]) });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Syphon Soul', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Syphon Soul', () => {
  test('two seats: 2 to the opponent, 2 back', () => {
    const g = syphoned(2);
    expect(g.state.players.p2?.life).toBe(38);
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('three seats: 2 to EACH, and the gain is the TOTAL', () => {
    const g = syphoned(3);
    expect(g.state.players.p2?.life).toBe(38);
    expect(g.state.players.p3?.life).toBe(38);
    expect(g.state.players.p1?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = syphoned(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
