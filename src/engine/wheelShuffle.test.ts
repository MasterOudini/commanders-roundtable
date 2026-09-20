// D510 - THE WHEEL INTO THE LIBRARY. `Each player shuffles their hand and graveyard into their library, then draws seven
// cards.` (Timetwister, Time Reversal, Echo of Eons, Time Spiral): every player in APNAP order - the hand and the
// graveyard into the library, one shuffle each off the seeded generator, seven drawn; the marker `WheelShuffled` per
// player. What is proven here: the readings (the each-player form, the `you` form, another count); Timetwister with a
// stocked graveyard on each side (both hands are seven fresh cards, both graveyards empty, the libraries hold what they
// held plus the hand and the graveyard less seven, Timetwister itself in p1's graveyard after resolving - it left the
// stack after the wheel); the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, amount: e.amount, scopes: e.scopes })) }; };
const sizes = (g: Game, who: 'p1' | 'p2') => ({ hand: (g.state.zones.hand[who] ?? []).length, gy: (g.state.zones.graveyard[who] ?? []).length, lib: (g.state.zones.library[who] ?? []).length });

describe('D510 - the wheel into the library', () => {
  test('the readings: the each-player form, the you form, another count', () => {
    expect(kinds('Each player shuffles their hand and graveyard into their library, then draws seven cards.')).toEqual({ mode: 'auto', effects: [{ kind: 'wheelShuffle', amount: 7, scopes: [{ kind: 'player', controller: 'any' }] }] });
    expect(kinds('Shuffle your hand and graveyard into your library, then draw seven cards.')).toEqual({ mode: 'auto', effects: [{ kind: 'wheelShuffle', amount: 7, scopes: [{ kind: 'player', controller: 'you' }] }] });
    expect(kinds('Each player shuffles their hand and graveyard into their library, then draws three cards.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'wheelShuffle', amount: 3 }] });
    expect(kinds('Each player shuffles their hand and graveyard into their library, then draws seven cards. Exile ~.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'wheelShuffle' }, { kind: 'exileSelf' }] });
  });

  test('Timetwister with a stocked graveyard on each side: fresh sevens, empty graveyards, the libraries hold the rest; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Timetwister', 'Grizzly Bears', 'Grizzly Bears'], ['Grizzly Bears', 'Grizzly Bears']] });
    holdEverywhere(g);
    put(g, 'p1', 'Grizzly Bears', 'graveyard');
    put(g, 'p1', 'Grizzly Bears', 'graveyard');
    put(g, 'p2', 'Grizzly Bears', 'graveyard');
    const spell = put(g, 'p1', 'Timetwister', 'hand');
    main(g, 3);
    const before1 = sizes(g, 'p1');
    const before2 = sizes(g, 'p2');
    expect(before1.gy, 'the two Bears put there').toBeGreaterThanOrEqual(2);
    expect(before2.gy, 'the Bears put there (and a cleanup discard, maybe)').toBeGreaterThanOrEqual(1);
    mana(g, 'p1', 'UUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    const after1 = sizes(g, 'p1');
    const after2 = sizes(g, 'p2');
    expect(after1.hand, 'p1 drew a fresh seven').toBe(7);
    expect(after2.hand, 'p2 drew a fresh seven').toBe(7);
    expect(after1.gy, "Timetwister alone in p1's graveyard - it left the stack after the wheel").toBe(1);
    expect(g.state.cards[spell]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(after2.gy).toBe(0);
    // p1: the hand less the spell and the graveyard went in, seven came out.
    expect(after1.lib).toBe(before1.lib + (before1.hand - 1) + before1.gy - 7);
    expect(after2.lib).toBe(before2.lib + before2.hand + before2.gy - 7);
    const wheels = g.log.filter((e) => e.body.t === 'WheelShuffled');
    expect(wheels.map((e) => (e.body.t === 'WheelShuffled' ? e.body.player : ''))).toEqual(['p1', 'p2']);
    // the opening shuffles came first; the wheel's two are the last, p1's then p2's.
    expect(g.log.filter((e) => e.body.t === 'LibraryShuffled').slice(-2).map((e) => (e.body.t === 'LibraryShuffled' ? e.body.player : ''))).toEqual(['p1', 'p2']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
