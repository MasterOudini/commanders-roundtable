// D352 — THE RETURN COST. "Return a land you control to its owner's hand" is a
// chooser (the tap chooser's shape, D286): the activation names the permanents,
// `legal.ts` offers the ability only while enough candidates exist, and
// `handlers.ts` re-validates the picks and bounces them in the cost batch —
// a client's word is not a rule. "Return this enchantment to its owner's hand"
// is the SELF form: deterministic, no chooser, the self-sacrifice's price one
// zone over, and the effect then resolves off a source in HAND.
//
// ⚠️ The generated rows prove the fourteen cards. THIS file proves the seam:
// the parse's edges, the offer's arithmetic, the re-validation's teeth, and
// that the self return leaves the source in hand with its effect still run.

import { describe, expect, test } from 'vitest';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { createRegistry } from './scripts/registryCore';
import { FLOODBRINGER_SCRIPT } from './scripts/cards/floodbringer';
import { MOLTING_SKIN_SCRIPT } from './scripts/cards/moltingSkin';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('D352 - the return cost, parsed', () => {
  test('"Return a land you control to its owner\'s hand" is a chooser the engine prices', () => {
    const [a] = parse("{2}, Return a land you control to its owner's hand: Tap target land.");
    expect(a?.returnCost).toEqual({ count: 1, another: false, any: [{ supertypes: [], types: ['Land'], subtypes: [], colors: [] }] });
    expect(a?.returnsSelf).toBe(false);
    expect(a?.unpaidCosts).toEqual([]);
    expect(a?.payable).toBe(true);
    expect(a?.manaCost?.generic).toBe(2);
  });

  test('a count reads the plural back to the singular, and "their owner\'s hand" is the same cost', () => {
    const [a] = parse("{3}, Return three lands you control to their owner's hand: Return target creature to its owner's hand.");
    expect(a?.returnCost).toEqual({ count: 3, another: false, any: [{ supertypes: [], types: ['Land'], subtypes: [], colors: [] }] });
    const [b] = parse("{U}{U}, Return two Islands you control to their owner's hand: Return target creature to its owner's hand.");
    expect(b?.returnCost?.count).toBe(2);
    expect(b?.returnCost?.any).toEqual([{ supertypes: [], types: [], subtypes: ['Island'], colors: [] }]);
  });

  test('a subtype names itself: a Forest, an Elf', () => {
    const [a] = parse("Return a Forest you control to its owner's hand: Untap target creature.");
    expect(a?.returnCost?.any).toEqual([{ supertypes: [], types: [], subtypes: ['Forest'], colors: [] }]);
    expect(a?.payable).toBe(true);
    const [b] = parse("Return an Elf you control to its owner's hand: Untap target creature.");
    expect(b?.returnCost?.any).toEqual([{ supertypes: [], types: [], subtypes: ['Elf'], colors: [] }]);
  });

  test('"Return this enchantment to its owner\'s hand" is the SELF form, no chooser', () => {
    const [a] = parse("Return this enchantment to its owner's hand: Regenerate target creature.");
    expect(a?.returnsSelf).toBe(true);
    expect(a?.returnCost).toBeNull();
    expect(a?.payable).toBe(true);
  });

  test('an older printing names the card itself', () => {
    const [a] = parseActivatedAbilities({
      oracleText: "Return Molting Skin to its owner's hand: Regenerate target creature.",
      isPermanent: true,
      producesMana: [],
      parseCost: (raw) => parseManaCost(raw),
      selfName: 'Molting Skin',
    });
    expect(a?.returnsSelf).toBe(true);
    expect(a?.payable).toBe(true);
  });

  // ⚠️ THE REFUSALS ARE THE POINT. A phrase the predicate grammar cannot place, a
  // return of something you do NOT control, and a return to somewhere other than
  // its owner's hand are each a cost the engine cannot charge — they stay unpaid
  // rather than being widened into something the app would silently mis-charge.
  test('a phrase outside the predicate grammar stays unpaid', () => {
    const [a] = parse("{1}, Return a creature with power 4 or greater you control to its owner's hand: Draw a card.");
    expect(a?.returnCost).toBeNull();
    expect(a?.payable).toBe(false);
    expect(a?.unpaidCosts).toEqual(['Return a creature with power 4 or greater you control to its owner\'s hand']);
  });

  test("someone else's permanent, and a destination that is not a hand, are not this cost", () => {
    const [a] = parse("{1}, Return target creature to its owner's hand: Draw a card.");
    expect(a?.returnCost).toBeNull();
    expect(a?.payable).toBe(false);
    const [b] = parse("{1}, Return a land you control to the battlefield: Draw a card.");
    expect(b?.returnCost).toBeNull();
    expect(b?.payable).toBe(false);
  });

  test('a plain mana ability stays what it was', () => {
    const [a] = parse('{T}: Add {G}.');
    expect(a?.returnCost).toBeNull();
    expect(a?.returnsSelf).toBe(false);
    expect(a?.payable).toBe(true);
  });
});

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armedFloodbringer(lands: number): { g: Game; self: InstanceId; forests: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Floodbringer', 'Forest', 'Forest'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([FLOODBRINGER_SCRIPT]),
  });
  holdEverywhere(g);
  const forests: InstanceId[] = [];
  for (let i = 0; i < lands; i++) forests.push(put(g, 'p1', 'Forest'));
  settle(g);
  const self = put(g, 'p1', 'Floodbringer');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, self, forests };
}

const offerFor = (g: Game, self: InstanceId) =>
  legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'ActivateAbility' && a.card === self);

describe('D352 - the return cost, offered and charged (Floodbringer)', () => {
  test('the offer names the candidates and the count', () => {
    const { g, self, forests } = armedFloodbringer(2);
    const offer = offerFor(g, self);
    expect(offer && offer.t === 'ActivateAbility' ? offer.returnCount : undefined).toBe(1);
    const candidates = offer && offer.t === 'ActivateAbility' ? (offer.returnCandidates ?? []) : [];
    for (const f of forests) expect(candidates).toContain(f);
    // ⚠️ Floodbringer itself is not a land, so it is not among its own candidates.
    expect(candidates).not.toContain(self);
  });

  // ⚠️ A COST YOU CANNOT PAY IS NOT OFFERED (the rule every chooser here keeps).
  test('with no land on the board the ability is not offered at all', () => {
    const { g, self } = armedFloodbringer(0);
    expect(offerFor(g, self)).toBeUndefined();
  });

  test('the chosen land goes to hand as the cost, and the effect still runs', () => {
    const { g, self, forests } = armedFloodbringer(2);
    const target = forests[1] as InstanceId;
    const paid = forests[0] as InstanceId;
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, returnToHand: [paid], targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(g.state.cards[paid]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(g.state.cards[target]?.tapped).toBe(true);
  });

  // ⚠️ THE HOST RE-VALIDATES: a permanent that does not match, or none at all, is refused.
  test("a permanent that cannot pay is refused, and so is naming none", () => {
    const { g, self, forests } = armedFloodbringer(1);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const none = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, targets: [{ kind: 'card', id: forests[0] as InstanceId }] });
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.reason).toBe('needsReturn');
    const wrong = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: self,
      abilityIndex: 0,
      returnToHand: [self],
      targets: [{ kind: 'card', id: forests[0] as InstanceId }],
    });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe('illegalReturn');
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, self, forests } = armedFloodbringer(2);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: self,
      abilityIndex: 0,
      returnToHand: [forests[0] as InstanceId],
      targets: [{ kind: 'card', id: forests[1] as InstanceId }],
    }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('D352 - the SELF return, charged (Molting Skin)', () => {
  test('the enchantment itself is the price: it ends in hand and the regeneration still happened', () => {
    const g = startedGame({
      players: 2,
      decks: [['Molting Skin', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']],
      scripts: createRegistry([MOLTING_SKIN_SCRIPT]),
    });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const self = put(g, 'p1', 'Molting Skin');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    // ⚠️ The source resolved its own effect from HAND — `resolveAbility` reads the stack
    // object's controller, never the board position of `self` (the api.ts rule).
    expect(g.state.cards[self]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(g.state.regenerationShields[bears] ?? 0).toBeGreaterThan(0);
  });
});
