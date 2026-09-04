// D312 - THE COST-REDUCTION SEAM, in the engine: Frogmite costs two artifacts
// less and nothing with four; Tolarian Terror costs an instant less per spell in
// the graveyard; Wizard's Retort costs one less beside a Wizard; the offer's
// tax carries the reduction (what the client prices), a face-up cast pays the
// reduced problem, the reduction never goes below the generic part, and the
// games replay.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { castReduction } from './costs';
import { legalActions } from './legal';
import { createRegistry } from './scripts/registry';
import { faceOf } from './oracle';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function main3(g: Game): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}

function mana(g: Game, symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
}

function reductionOf(g: Game, card: InstanceId): number {
  const d = deps(createRegistry([]));
  const inst = g.state.cards[card];
  const oracleCard = inst ? d.oracle.byPrinting(inst.printingId) : undefined;
  if (!inst || !oracleCard) throw new Error('no card');
  return castReduction(g.state, d.oracle, d.scripts, 'p1', faceOf(oracleCard, 0));
}

function offerTax(g: Game, card: InstanceId): number | undefined {
  const d = deps(createRegistry([]));
  const offer = legalActions(g.state, d.oracle, d.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);
  return offer && offer.t === 'CastSpell' ? offer.tax : undefined;
}

describe('the cost-reduction seam (D312)', () => {
  test('Frogmite: {4} less two artifacts is {2}; four artifacts make it free', () => {
    const g = startedGame({ players: 2, decks: [['Frogmite', 'Sky Skiff', 'Lightning Greaves', 'Consulate Dreadnought', 'Myr Enforcer'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    put(g, 'p1', 'Sky Skiff');
    put(g, 'p1', 'Lightning Greaves');
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const frog = put(g, 'p1', 'Frogmite', 'hand');
    main3(g);
    expect(reductionOf(g, frog)).toBe(2);
    expect(offerTax(g, frog)).toBe(-2);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: frog, targets: [] }));
    settle(g);
    expect(g.state.cards[frog]?.zone.kind).toBe('battlefield');
    put(g, 'p1', 'Consulate Dreadnought');
    settle(g);
    const enforcer = put(g, 'p1', 'Myr Enforcer', 'hand');
    // Sky Skiff, Greaves, Frogmite, Dreadnought: four artifacts against {7}.
    expect(reductionOf(g, enforcer)).toBe(4);
    expect(offerTax(g, enforcer)).toBe(-4);
    mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: enforcer, targets: [] }));
    settle(g);
    expect(g.state.cards[enforcer]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a reduction empties the generic part and never more: Frogmite with six artifacts still costs nothing, not less', () => {
    const g = startedGame({ players: 2, decks: [['Frogmite', 'Sky Skiff', 'Lightning Greaves', 'Consulate Dreadnought', 'Myr Enforcer', "Cultivator's Caravan", 'Rover Blades'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    for (const name of ['Sky Skiff', 'Lightning Greaves', 'Consulate Dreadnought', 'Myr Enforcer', "Cultivator's Caravan"]) put(g, 'p1', name);
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const frog = put(g, 'p1', 'Frogmite', 'hand');
    main3(g);
    expect(reductionOf(g, frog)).toBe(5);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: frog, targets: [] }));
    settle(g);
    expect(g.state.cards[frog]?.zone.kind).toBe('battlefield');
  });

  test('Tolarian Terror: {6}{U} less one per instant or sorcery card in your graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Tolarian Terror', 'Counterspell', 'Feeling of Dread', 'Beast Attack', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    for (const name of ['Counterspell', 'Feeling of Dread', 'Beast Attack', 'Grizzly Bears']) put(g, 'p1', name, 'graveyard');
    const terror = put(g, 'p1', 'Tolarian Terror', 'hand');
    main3(g);
    expect(reductionOf(g, terror)).toBe(3);
    expect(offerTax(g, terror)).toBe(-3);
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: terror, targets: [] }));
    settle(g);
    expect(g.state.cards[terror]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Wizard's Retort: {1}{U}{U} less one beside a Wizard, the full price without", () => {
    const g = startedGame({ players: 2, decks: [["Wizard's Retort", 'Kess, Dissident Mage'], ['Cyclops of One-Eyed Pass', 'Grizzly Bears']], scripts: createRegistry([]) });
    holdEverywhere(g);
    put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const retort = put(g, 'p1', "Wizard's Retort", 'hand');
    main3(g);
    expect(reductionOf(g, retort)).toBe(0);
    put(g, 'p1', 'Kess, Dissident Mage');
    settle(g);
    expect(reductionOf(g, retort)).toBe(1);
    expect(offerTax(g, retort)).toBe(-1);
  });
});
