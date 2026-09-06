// D342 - THE ACTIVATION CONDITIONS (CR 602.5b-d): "Activate only <condition>."
// The parser reads a closed vocabulary into `ActivatedAbility.activateOnly`, an
// unread condition is an UNPAID cost, and the evaluator answers every condition
// from the turn, the derived board, the hand and the graveyard. The generated
// rows prove the offer and the refusal per card; this suite pins the grammar and
// the evaluator's answers on a real board.
import { describe, expect, test } from 'vitest';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { activationConditionsHold, describeActivationConditions } from './activationConditions';
import { advanceUntil, deps, holdEverywhere, put, startedGame } from './testing/harness';
import type { ActivatedAbility } from './types/oracle';

function ability(text: string, selfName = 'Test Card'): ActivatedAbility {
  const a = parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw), selfName })[0];
  if (!a) throw new Error('no ability parsed from ' + text);
  return a;
}

describe('D342 - the activation conditions', () => {
  test('the timing clauses read', () => {
    expect(ability('{T}: Draw a card. Activate only during your upkeep.').activateOnly).toEqual([{ kind: 'duringStep', step: 'upkeep', whose: 'yours' }]);
    expect(ability('{T}: Draw a card. Activate only during your turn, before attackers are declared.').activateOnly).toEqual([
      { kind: 'duringYourTurn' },
      { kind: 'beforeAttackersDeclared' },
    ]);
    expect(ability('{T}: Draw a card. Activate only during your turn.').activateOnly).toEqual([{ kind: 'duringYourTurn' }]);
    expect(ability("{T}: Draw a card. Activate only during an opponent's turn.").activateOnly).toEqual([{ kind: 'duringOpponentsTurn' }]);
    expect(ability('{T}: Draw a card. Activate only during any upkeep step.').activateOnly).toEqual([{ kind: 'duringStep', step: 'upkeep', whose: 'any' }]);
    expect(ability('{T}: Draw a card. Activate only during combat.').activateOnly).toEqual([{ kind: 'duringCombat' }]);
    // No restriction at all, and still payable.
    const instant = ability('{T}: Draw a card. Activate only as an instant.');
    expect(instant.activateOnly).toEqual([]);
    expect(instant.payable).toBe(true);
  });

  test('the compound tails read every clause', () => {
    const a = ability('{T}: Draw a card. Activate only as a sorcery and only once each turn.');
    expect(a.sorceryOnly).toBe(true);
    expect(a.oncePerTurn).toBe(true);
    expect(a.activateOnly).toEqual([]);
    const b = ability('{T}: Draw a card. Activate only during your upkeep and only if you control a Swamp.');
    expect(b.activateOnly).toEqual([
      { kind: 'duringStep', step: 'upkeep', whose: 'yours' },
      { kind: 'board', condition: { kind: 'controlPermanent', any: [{ supertypes: [], types: [], subtypes: ['Swamp'], colors: [] }] } },
    ]);
    expect(b.payable).toBe(true);
  });

  test('the board clauses read', () => {
    expect(ability('{T}: Draw a card. Activate only if you control five or more lands.').activateOnly).toEqual([
      { kind: 'controlCount', count: 5, any: [{ supertypes: [], types: ['Land'], subtypes: [], colors: [] }] },
    ]);
    expect(ability('{T}: Draw a card. Activate only if you control two or more black permanents.').activateOnly).toEqual([
      { kind: 'controlCount', count: 2, any: [{ supertypes: [], types: [], subtypes: [], colors: ['B'] }] },
    ]);
    expect(ability('{T}: Draw a card. Activate only if you control a legendary creature.').activateOnly).toEqual([
      { kind: 'board', condition: { kind: 'controlPermanent', any: [{ supertypes: ['Legendary'], types: ['Creature'], subtypes: [], colors: [] }] } },
    ]);
    expect(ability("{T}: Draw a card. Activate only if this creature's power is 4 or greater.").activateOnly).toEqual([{ kind: 'selfPowerAtLeast', power: 4 }]);
    expect(ability("{T}: Draw a card. Activate only if Test Card's power is 4 or greater.").activateOnly).toEqual([{ kind: 'selfPowerAtLeast', power: 4 }]);
    expect(ability('{T}: Draw a card. Activate only if you have no cards in hand.').activateOnly).toEqual([{ kind: 'handSize', cmp: 'atMost', count: 0 }]);
    expect(ability('{T}: Draw a card. Activate only if you have one or fewer cards in hand.').activateOnly).toEqual([{ kind: 'handSize', cmp: 'atMost', count: 1 }]);
    expect(ability('{T}: Draw a card. Activate only if there are four or more creature cards in your graveyard.').activateOnly).toEqual([
      { kind: 'graveyardCards', count: 4, types: ['Creature'] },
    ]);
    expect(ability('{T}: Draw a card. Activate only if this creature is a creature.').activateOnly).toEqual([{ kind: 'selfIsCreature' }]);
  });

  test('an ability word is stripped from the cost; a keyword printed in its shape is not', () => {
    const threshold = ability('Threshold — {1}{G}: Regenerate this creature. Activate only if there are seven or more cards in your graveyard.');
    expect(threshold.payable).toBe(true);
    expect(threshold.costText).toBe('Threshold — {1}{G}');
    expect(threshold.activateOnly).toEqual([{ kind: 'graveyardCards', count: 7, types: [] }]);
    // Boast and Exhaust carry rules the card does not print: never charged as a bare cost.
    expect(ability('Boast — {1}: Draw a card.').payable).toBe(false);
    expect(ability('Exhaust — {2}: Draw a card.').payable).toBe(false);
  });

  test('a clause outside the vocabulary is an unpaid cost, never dropped', () => {
    for (const tail of [
      'if a creature died this turn',
      "if you've cast a noncreature spell this turn",
      'if you control two or more Elves',
      'if you control a creature with flying',
      'if you have exactly seven cards in hand and only if an opponent lost life this turn',
    ]) {
      const a = ability(`{T}: Draw a card. Activate only ${tail}.`);
      expect(a.payable, tail).toBe(false);
      expect(a.unpaidCosts.some((c) => c.startsWith('activate only ')), tail).toBe(true);
    }
    // A read clause beside an unread one still refuses the whole ability.
    const mixed = ability('{T}: Draw a card. Activate only during your turn and only if a creature died this turn.');
    expect(mixed.payable).toBe(false);
    expect(mixed.activateOnly).toEqual([{ kind: 'duringYourTurn' }]);
  });

  test('the evaluator reads the turn', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Grizzly Bears', 'Swamp', 'Swamp', 'Sol Ring'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const d = deps();
    const bears = put(g, 'p1', 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const holds = (...conds: Parameters<typeof activationConditionsHold>[5]): boolean => activationConditionsHold(g.state, d.oracle, d.scripts, 'p1', bears, conds);
    expect(holds({ kind: 'duringYourTurn' })).toBe(true);
    expect(holds({ kind: 'duringOpponentsTurn' })).toBe(false);
    expect(holds({ kind: 'beforeAttackersDeclared' })).toBe(true);
    expect(holds({ kind: 'duringStep', step: 'upkeep', whose: 'yours' })).toBe(false);
    expect(holds({ kind: 'duringCombat' })).toBe(false);
    expect(holds()).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.step === 'beginCombat' && s.priority.player === 'p1', 20_000);
    expect(holds({ kind: 'duringCombat' })).toBe(true);
    expect(holds({ kind: 'beforeAttackersDeclared' })).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'postcombatMain' && s.priority.player === 'p1', 20_000);
    expect(holds({ kind: 'beforeAttackersDeclared' })).toBe(false);
    expect(holds({ kind: 'duringYourTurn' })).toBe(true);
    // The opponent's upkeep: theirs, not yours.
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'upkeep' && s.priority.player === 'p1', 20_000);
    expect(holds({ kind: 'duringYourTurn' })).toBe(false);
    expect(holds({ kind: 'duringOpponentsTurn' })).toBe(true);
    expect(holds({ kind: 'duringStep', step: 'upkeep', whose: 'yours' })).toBe(false);
    expect(holds({ kind: 'duringStep', step: 'upkeep', whose: 'any' })).toBe(true);
    expect(holds({ kind: 'duringYourTurn' }, { kind: 'duringStep', step: 'upkeep', whose: 'any' })).toBe(false);
  });

  test('the evaluator reads the board, the hand and the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Grizzly Bears', 'Swamp', 'Swamp', 'Sol Ring'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const d = deps();
    const bears = put(g, 'p1', 'Grizzly Bears');
    const ring = put(g, 'p1', 'Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const holds = (source: string, ...conds: Parameters<typeof activationConditionsHold>[5]): boolean => activationConditionsHold(g.state, d.oracle, d.scripts, 'p1', source, conds);
    const swamp = { kind: 'board', condition: { kind: 'controlPermanent', any: [{ supertypes: [], types: [], subtypes: ['Swamp'], colors: [] }] } } as const;
    const twoLands = { kind: 'controlCount', count: 2, any: [{ supertypes: [], types: ['Land'], subtypes: [], colors: [] }] } as const;
    expect(holds(bears, swamp)).toBe(false);
    put(g, 'p1', 'Swamp');
    expect(holds(bears, swamp)).toBe(true);
    expect(holds(bears, twoLands)).toBe(false);
    put(g, 'p1', 'Swamp');
    expect(holds(bears, twoLands)).toBe(true);
    expect(holds(bears, { kind: 'selfPowerAtLeast', power: 2 })).toBe(true);
    expect(holds(bears, { kind: 'selfPowerAtLeast', power: 3 })).toBe(false);
    expect(holds(ring, { kind: 'selfPowerAtLeast', power: 1 })).toBe(false);
    expect(holds(bears, { kind: 'selfIsCreature' })).toBe(true);
    expect(holds(ring, { kind: 'selfIsCreature' })).toBe(false);
    expect(holds(bears, { kind: 'handSize', cmp: 'atMost', count: 0 })).toBe(false);
    expect(holds(bears, { kind: 'handSize', cmp: 'atLeast', count: 1 })).toBe(true);
    const gy = { kind: 'graveyardCards', count: 1, types: ['Creature'] } as const;
    expect(holds(bears, gy)).toBe(false);
    put(g, 'p1', 'Grizzly Bears', 'graveyard');
    expect(holds(bears, gy)).toBe(true);
    expect(holds(bears, { kind: 'graveyardCards', count: 1, types: ['Artifact'] })).toBe(false);
  });

  test('the refusal names the condition', () => {
    expect(describeActivationConditions([{ kind: 'duringStep', step: 'upkeep', whose: 'yours' }])).toBe('during your upkeep step');
    expect(describeActivationConditions([{ kind: 'duringYourTurn' }, { kind: 'beforeAttackersDeclared' }])).toBe('during your turn and only before attackers are declared');
  });
});
