// D450 - VANISHING (CR 702.63) AND FADING (CR 702.32): the counted-down keywords. "Vanishing N" is "this permanent
// enters with N time counters; at the beginning of your upkeep, if it has a time counter, remove one; when the last
// is removed, sacrifice it", and "Fading N" is "N fade counters; at the beginning of your upkeep remove one - if you
// can't, sacrifice it". The entry counters come from `withEntryCounters` (the built-in, beside modular's); the
// triggers from the keyword table, which may now carry TWO entries for one keyword (`vanishing` and `vanishingLast`,
// the second gated by `keyword: 'vanishing'`). Proven on Calciderm (vanishing 4) and Blastoderm (fading 3), 5/5s
// with no script at all.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SCRIPTS = createRegistry([]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function myUpkeepDone(g: Game, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 40_000);
}
function armed(name: string): { g: Game; card: InstanceId } {
  const g = startedGame({ players: 2, decks: [[name], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  const card = put(g, 'p1', name);
  settle(g);
  return { g, card };
}

describe('D450 - the keywords are read', () => {
  test('Calciderm carries vanishing and Blastoderm fading', () => {
    expect(ORACLE.byName('Calciderm')?.faces[0]?.keywords).toContain('vanishing');
    expect(ORACLE.byName('Blastoderm')?.faces[0]?.keywords).toContain('fading');
  });
});

describe('D450 - vanishing (Calciderm)', () => {
  test('it enters with four time counters, loses one each of its controller upkeeps, and is sacrificed as the last goes', () => {
    const { g, card } = armed('Calciderm');
    expect(g.state.cards[card]?.counters['time'] ?? 0).toBe(4);
    // p1 put it on turn 1 (its own): the next own upkeep is turn 3.
    myUpkeepDone(g, 3);
    expect(g.state.cards[card]?.counters['time'] ?? 0).toBe(3);
    // The opponent's upkeep (turn 4) removes nothing.
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 40_000);
    expect(g.state.cards[card]?.counters['time'] ?? 0).toBe(3);
    myUpkeepDone(g, 5);
    expect(g.state.cards[card]?.counters['time'] ?? 0).toBe(2);
    myUpkeepDone(g, 7);
    expect(g.state.cards[card]?.counters['time'] ?? 0).toBe(1);
    myUpkeepDone(g, 9);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === card && m.reason === 'sacrifice'))).toBe(true);
  });

  test('a time counter removed by hand at the last is the sacrifice too; one added keeps it', () => {
    const { g, card } = armed('Calciderm');
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card, kind: 'time', delta: -3 }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card, kind: 'time', delta: -1 }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
  });
});

describe('D450 - fading (Blastoderm)', () => {
  test('it enters with three fade counters, loses one each upkeep, and is sacrificed the upkeep it has none', () => {
    const { g, card } = armed('Blastoderm');
    expect(g.state.cards[card]?.counters['fade'] ?? 0).toBe(3);
    myUpkeepDone(g, 3);
    expect(g.state.cards[card]?.counters['fade'] ?? 0).toBe(2);
    myUpkeepDone(g, 5);
    expect(g.state.cards[card]?.counters['fade'] ?? 0).toBe(1);
    myUpkeepDone(g, 7);
    expect(g.state.cards[card]?.counters['fade'] ?? 0).toBe(0);
    expect(g.state.cards[card]?.zone.kind).toBe('battlefield');
    myUpkeepDone(g, 9);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed('Blastoderm');
    myUpkeepDone(g, 9);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
