// D447 - THE ANY-KIND REMOVE-A-COUNTER COST. "Remove a counter from this creature" names no kind,
// and D319 refused it on the ground that the engine cannot enumerate what it cannot represent. It
// can, after all: `CounterKind` is +1/+1 and -1/-1 (D130) and the two annihilate in pairs as a
// state-based action (CR 704.5q), so a permanent carries ONE kind whenever a player has priority -
// the price is deterministic and the engine takes the kind the permanent carries (`kind: null` in
// `removeCounterCost`; SELF only - the chooser over the board still names its kind). Proven on
// Moonlit Lamenter's generated script: it enters with a -1/-1 counter, the cost takes it, a second
// activation is refused with nothing to take, and a +1/+1 counter put on it by hand is taken next -
// the kind carried, whichever it is.

import { describe, expect, test } from 'vitest';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { MOONLIT_LAMENTER_SCRIPT } from './scripts/cards/moonlitLamenter';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('D447 - the any-kind remove-a-counter cost, parsed', () => {
  test('"Remove a counter from this creature" is a price with no kind named', () => {
    const [a] = parse('{1}{W}, Remove a counter from this creature: Draw a card.');
    expect(a?.removeCounterCost).toEqual({ kind: null, count: 1, from: null });
    expect(a?.unpaidCosts).toEqual([]);
    expect(a?.payable).toBe(true);
  });

  test('"Remove two counters from this creature" counts two', () => {
    const [a] = parse('{2}{B}, Remove two counters from this creature: Target creature gets -2/-2 until end of turn.');
    expect(a?.removeCounterCost).toEqual({ kind: null, count: 2, from: null });
    expect(a?.payable).toBe(true);
  });

  test('the chooser over the board still needs a kind: "Remove a counter from a creature you control" stays unpaid', () => {
    const [a] = parse('{T}, Remove a counter from a creature you control: Draw a card.');
    expect(a?.removeCounterCost).toBeNull();
    expect(a?.unpaidCosts).toEqual(['Remove a counter from a creature you control']);
  });
});

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: ReturnType<typeof put>; hand0: number } {
  const g = startedGame({
    players: 2,
    decks: [['Moonlit Lamenter'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([MOONLIT_LAMENTER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const self = put(g, 'p1', 'Moonlit Lamenter');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, self, hand0: (g.state.zones.hand.p1 ?? []).length };
}

function activate(g: Game, self: ReturnType<typeof put>): ReturnType<Game['submit']> {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 });
}

describe('D447 - the any-kind remove-a-counter cost, charged (Moonlit Lamenter)', () => {
  test('the -1/-1 counter it entered with pays; nothing left refuses; a +1/+1 counter put by hand pays next', () => {
    const { g, self, hand0 } = armed();
    expect(g.state.cards[self]?.counters['-1/-1'] ?? 0).toBe(1);
    must(activate(g, self));
    settle(g);
    expect(g.state.cards[self]?.counters['-1/-1'] ?? 0).toBe(0);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    // Nothing to take: refused before any mana is spent on it.
    const second = activate(g, self);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('notCastable');
    // The OTHER kind pays just the same - the cost takes the kind the permanent carries.
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: '+1/+1', delta: 1 }));
    settle(g);
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    must(activate(g, self));
    settle(g);
    expect(g.state.cards[self]?.counters['+1/+1'] ?? 0).toBe(0);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 2);
  });

  test('replays to the same hash', () => {
    const { g, self } = armed();
    must(activate(g, self));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
