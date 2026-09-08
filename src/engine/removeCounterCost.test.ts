// D319 — THE REMOVE-A-COUNTER COST. "Remove a +1/+1 counter from this
// creature" is SELF only and a fixed count: deterministic, no chooser, so a
// price the engine takes (parsed here; offered by `legal.ts` only while the
// counters are there and only with a registered def; charged by `handlers.ts`
// beside the self-sacrifice). "From a creature you control" was a decision and
// stayed unpaid until D363 built the chooser for it - `removeCounterCost.from`
// is null HERE and a predicate list THERE, and `removeCounterChooser.test.ts`
// proves that half. "X" is still a computed cost and still unpaid. The charge
// is proven on Spike Feeder's generated
// script: two counters on entry (CR 614.12, D318), two life per counter
// removed, and the third activation refused with the counters gone.

import { describe, expect, test } from 'vitest';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { SPIKE_FEEDER_SCRIPT } from './scripts/cards/spikeFeeder';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('D319 - the remove-a-counter cost, parsed', () => {
  test('"Remove a +1/+1 counter from this creature" is a price the engine takes', () => {
    const [a] = parse('{2}, Remove a +1/+1 counter from this creature: Draw a card.');
    expect(a?.removeCounterCost).toEqual({ kind: '+1/+1', count: 1, from: null });
    expect(a?.unpaidCosts).toEqual([]);
    expect(a?.payable).toBe(true);
    expect(a?.manaCost?.generic).toBe(2);
  });

  test('two charge counters from this artifact, with the tap', () => {
    const [a] = parse('{T}, Remove two charge counters from this artifact: Add {C}{C}.');
    // ⚠️ The SELF form takes ANY counter kind - the engine removes what the card
    // says without needing to represent it. D363's CHOOSER cannot: it names a
    // permanent the player picks, so the kind must be one `CounterKind` holds.
    expect(a?.removeCounterCost).toEqual({ kind: 'charge', count: 2, from: null });
    expect(a?.requiresTap).toBe(true);
    expect(a?.payable).toBe(true);
  });

  // ⚠️ THIS CASE CHANGED SIDES IN D363, and the old one is gone rather than
  // adapted: it asserted that a counter removed from a permanent the player
  // NAMES stays unpaid, which was true only while the engine had no chooser
  // for it. It has one now, so what is worth pinning HERE is the boundary -
  // `from` is null for the SELF form and a predicate list for the chooser.
  test('"from a creature you control" is the CHOOSER, and `from` is what tells them apart', () => {
    const [a] = parse('{1}, Remove a +1/+1 counter from a creature you control: Draw a card.');
    expect(a?.removeCounterCost).toEqual({
      kind: '+1/+1',
      count: 1,
      from: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }],
    });
    expect(a?.payable).toBe(true);
    expect(a?.unpaidCosts).toEqual([]);
    const [self] = parse('{1}, Remove a +1/+1 counter from this creature: Draw a card.');
    expect(self?.removeCounterCost?.from).toBeNull();
  });

  test('"Remove X +1/+1 counters" is a computed cost and stays unpaid', () => {
    const [a] = parse('{1}, Remove X +1/+1 counters from this creature: Draw X cards.');
    expect(a?.removeCounterCost).toBeNull();
    expect(a?.payable).toBe(false);
  });

  test('an older printing names the card itself: "from Brigone" (D320)', () => {
    const [a] = parseActivatedAbilities({
      oracleText: '{T}, Remove a +1/+1 counter from Brigone: Draw a card.',
      isPermanent: true,
      producesMana: [],
      parseCost: (raw) => parseManaCost(raw),
      selfName: 'Brigone',
    });
    expect(a?.removeCounterCost).toEqual({ kind: '+1/+1', count: 1, from: null });
    expect(a?.payable).toBe(true);
    const [other] = parse('{T}, Remove a +1/+1 counter from Brigone: Draw a card.');
    expect(other?.removeCounterCost).toBeNull();
  });

  test('a plain mana ability stays what it was', () => {
    const [a] = parse('{T}: Add {G}.');
    expect(a?.removeCounterCost).toBeNull();
    expect(a?.payable).toBe(true);
  });
});

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; feeder: ReturnType<typeof put>; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [['Spike Feeder'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([SPIKE_FEEDER_SCRIPT]),
  });
  holdEverywhere(g);
  const feeder = put(g, 'p1', 'Spike Feeder');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, feeder, life0: g.state.players.p1?.life ?? 0 };
}

describe('D319 - the remove-a-counter cost, charged (Spike Feeder)', () => {
  test('it enters with two counters; each removal is two life; the third activation is refused', () => {
    const { g, feeder, life0 } = armed();
    expect(g.state.cards[feeder]?.counters['+1/+1'] ?? 0).toBe(2);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: feeder, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[feeder]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(g.state.players.p1?.life).toBe(life0 + 2);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: feeder, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[feeder]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(g.state.players.p1?.life).toBe(life0 + 4);
    const third = g.submit({ t: 'ActivateAbility', player: 'p1', card: feeder, abilityIndex: 1 });
    expect(third.ok).toBe(false);
    // D342 - the second removal emptied the 0/0 Feeder's counters and the state-based action
    // binned it, so the third activation is refused by ZONE first (an ordinary ability is
    // activated from the battlefield, CR 602.2), ahead of the counter check it used to reach.
    if (!third.ok) expect(third.reason).toBe('wrongZone');
    expect(g.state.players.p1?.life).toBe(life0 + 4);
  });

  test('replays to the same hash', () => {
    const { g, feeder } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: feeder, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
