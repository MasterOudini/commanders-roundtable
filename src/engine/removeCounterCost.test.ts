// D319 — THE REMOVE-A-COUNTER COST. "Remove a +1/+1 counter from this
// creature" is SELF only and a fixed count: deterministic, no chooser, so a
// price the engine takes (parsed here; offered by `legal.ts` only while the
// counters are there and only with a registered def; charged by `handlers.ts`
// beside the self-sacrifice). "From a creature you control" is a decision and
// stays unpaid; so does "X". The charge is proven on Spike Feeder's generated
// script: two counters on entry (CR 614.12, D318), two life per counter
// removed, and the third activation refused with the counters gone.

import { describe, expect, test } from 'vitest';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import { SPIKE_FEEDER_SCRIPT } from './scripts/cards/spikeFeeder';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('D319 - the remove-a-counter cost, parsed', () => {
  test('"Remove a +1/+1 counter from this creature" is a price the engine takes', () => {
    const [a] = parse('{2}, Remove a +1/+1 counter from this creature: Draw a card.');
    expect(a?.removeCounterCost).toEqual({ kind: '+1/+1', count: 1 });
    expect(a?.unpaidCosts).toEqual([]);
    expect(a?.payable).toBe(true);
    expect(a?.manaCost?.generic).toBe(2);
  });

  test('two charge counters from this artifact, with the tap', () => {
    const [a] = parse('{T}, Remove two charge counters from this artifact: Add {C}{C}.');
    expect(a?.removeCounterCost).toEqual({ kind: 'charge', count: 2 });
    expect(a?.requiresTap).toBe(true);
    expect(a?.payable).toBe(true);
  });

  test('"from a creature you control" is a decision and stays unpaid', () => {
    const [a] = parse('{1}, Remove a +1/+1 counter from a creature you control: Draw a card.');
    expect(a?.removeCounterCost).toBeNull();
    expect(a?.payable).toBe(false);
    expect(a?.unpaidCosts).toEqual(['Remove a +1/+1 counter from a creature you control']);
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
    expect(a?.removeCounterCost).toEqual({ kind: '+1/+1', count: 1 });
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
    if (!third.ok) expect(third.reason).toBe('notCastable');
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
