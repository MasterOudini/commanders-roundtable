// D363 — THE REMOVE-COUNTER CHOOSER. D319 built this cost as SELF only and a
// fixed count, deliberately: that shape is deterministic, which is exactly what
// made it a PRICE the engine could take rather than a decision. A counter removed
// from a permanent the player NAMES is a chooser — the fifth verb after sacrifice
// (D168), discard and tap (D286), exile-from-graveyard (D329) and return (D352).
//
// ⚠️ Its picks are a MULTISET where every other chooser's are a set: "remove two
// +1/+1 counters from among creatures you control" may take both from ONE creature
// carrying two, so a permanent named k times must carry k counters. That is the
// one thing this verb does not inherit, and most of what this file proves.
//
// ⚠️ The generated rows prove the eight cards. THIS file proves the seam: the
// parse's edges (including the kinds the engine cannot represent), the offer's
// arithmetic over COUNTERS rather than permanents, and the re-validation's teeth.

import { describe, expect, test } from 'vitest';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { createRegistry } from './scripts/registryCore';
import { GHAVE_GURU_OF_SPORES_SCRIPT } from './scripts/cards/ghaveGuruOfSpores';
import { HOPEFUL_INITIATE_SCRIPT } from './scripts/cards/hopefulInitiate';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('D363 - the remove-counter chooser, parsed', () => {
  test('"from a creature you control" is a chooser the engine prices', () => {
    const [a] = parse('{1}, Remove a +1/+1 counter from a creature you control: Draw a card.');
    expect(a?.removeCounterCost).toEqual({
      kind: '+1/+1',
      count: 1,
      from: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }],
    });
    expect(a?.payable).toBe(true);
    expect(a?.unpaidCosts).toEqual([]);
  });

  test('"from among" is the same cost with a count, and the plural reads back to the singular', () => {
    const [a] = parse('{2}{W}, Remove two +1/+1 counters from among creatures you control: Draw a card.');
    expect(a?.removeCounterCost?.count).toBe(2);
    expect(a?.removeCounterCost?.from).toEqual([{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }]);
  });

  test('a -1/-1 counter is the other kind the engine can represent', () => {
    const [a] = parse('{B/G}, Remove a -1/-1 counter from a creature you control: Draw a card.');
    expect(a?.removeCounterCost?.kind).toBe('-1/-1');
    expect(a?.payable).toBe(true);
  });

  test('"from this creature" is still the SELF form D319 shipped', () => {
    const [a] = parse('{2}, Remove a +1/+1 counter from this creature: Draw a card.');
    expect(a?.removeCounterCost).toEqual({ kind: '+1/+1', count: 1, from: null });
    expect(a?.payable).toBe(true);
  });

  // ⚠️ THE REFUSALS ARE THE POINT, and all three are about what the engine can
  // REPRESENT rather than about what it can read. `CounterKind` is +1/+1 and
  // -1/-1 (D130), so a counter this engine never puts is one it cannot remove;
  // and the predicate grammar is `predicatesOf`'s, so a word it cannot place
  // refuses the whole cost rather than being widened into a wrong charge.
  test('a counter of no stated kind is refused - the engine cannot enumerate what it cannot represent', () => {
    const [a] = parse('{T}, Remove a counter from a creature you control: Create a Treasure token.');
    expect(a?.removeCounterCost).toBeNull();
    expect(a?.payable).toBe(false);
    expect(a?.unpaidCosts).toEqual(['Remove a counter from a creature you control']);
  });

  test('a charge counter is refused, and so is a KIND LIST', () => {
    const [a] = parse('{1}, Remove a charge counter from an artifact you control: Draw a card.');
    expect(a?.removeCounterCost).toBeNull();
    const [b] = parse('{1}{R}, Remove a +1/+1 counter or a charge counter from a permanent you control: Draw a card.');
    expect(b?.removeCounterCost).toBeNull();
    expect(b?.payable).toBe(false);
  });

  test('a predicate the grammar cannot place stays unpaid', () => {
    const [a] = parse('{T}, Remove a +1/+1 counter from a nonland permanent you control: Draw a card.');
    expect(a?.removeCounterCost).toBeNull();
    expect(a?.payable).toBe(false);
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

const offerFor = (g: Game, self: InstanceId) =>
  legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'ActivateAbility' && a.card === self);

/** Ghave: `{1}, Remove a +1/+1 counter from a creature you control: Create a Saproling.` */
function armedGhave(counters: number): { g: Game; self: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Ghave, Guru of Spores', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([GHAVE_GURU_OF_SPORES_SCRIPT]),
  });
  holdEverywhere(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  if (counters > 0) must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: counters }));
  settle(g);
  const self = put(g, 'p1', 'Ghave, Guru of Spores');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, self, bears };
}

describe('D363 - the remove-counter chooser, offered and charged', () => {
  test('the offer names the candidates, the count and the kind', () => {
    const { g, self, bears } = armedGhave(1);
    const offer = offerFor(g, self);
    if (!offer || offer.t !== 'ActivateAbility') throw new Error('the ability was not offered');
    expect(offer.removeCounterCount).toBe(1);
    expect(offer.removeCounterKind).toBe('+1/+1');
    expect(offer.removeCounterCandidates).toContain(bears);
    // ⚠️ Ghave enters with five +1/+1 counters of its own, so it is a candidate
    // for its own cost - the predicate is "a creature you control", not "another".
    expect(offer.removeCounterCandidates).toContain(self);
  });

  // ⚠️ A COST YOU CANNOT PAY IS NOT OFFERED - the rule every chooser here keeps.
  // The arithmetic is over COUNTERS, not permanents: Ghave itself carries five,
  // so this is proven with a card that carries none.
  test('a creature with no counters is not among the candidates', () => {
    const { g, self, bears } = armedGhave(0);
    const offer = offerFor(g, self);
    if (!offer || offer.t !== 'ActivateAbility') throw new Error('the ability was not offered');
    expect(offer.removeCounterCandidates).not.toContain(bears);
  });

  test('a legal pick takes the counter off the NAMED permanent, not off the source', () => {
    const { g, self, bears } = armedGhave(1);
    const ghave0 = g.state.cards[self]?.counters['+1/+1'] ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, removeCounter: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(g.state.cards[self]?.counters['+1/+1'] ?? 0).toBe(ghave0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a permanent with no counter of that kind cannot pay, and neither can a wrong count', () => {
    const { g, self, bears } = armedGhave(0);
    const wrong = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, removeCounter: [bears] });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe('illegalRemoveCounter');
    const tooMany = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, removeCounter: [self, self] });
    expect(tooMany.ok).toBe(false);
    const none = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 });
    expect(none.ok).toBe(false);
  });
});

/** Hopeful Initiate: `{2}{W}, Remove two +1/+1 counters from among creatures you control: ...` */
function armedInitiate(counters: number): { g: Game; self: InstanceId; bears: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hopeful Initiate', 'Grizzly Bears', 'Sol Ring'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([HOPEFUL_INITIATE_SCRIPT]),
  });
  holdEverywhere(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  if (counters > 0) must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: counters }));
  const ring = put(g, 'p1', 'Sol Ring');
  settle(g);
  const self = put(g, 'p1', 'Hopeful Initiate');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, self, bears, ring };
}

describe('D363 - the picks are a MULTISET', () => {
  // ⚠️ THE DIFFERENCE FROM EVERY OTHER CHOOSER. Two counters may come off ONE
  // creature, so naming it twice is legal - and the offer's arithmetic must count
  // COUNTERS rather than candidates, or a board with one two-counter creature
  // would be called unpayable.
  test('one creature carrying two counters pays a count of two on its own', () => {
    const { g, self, bears, ring } = armedInitiate(2);
    const offer = offerFor(g, self);
    if (!offer || offer.t !== 'ActivateAbility') throw new Error('the ability was not offered');
    expect(offer.removeCounterCount).toBe(2);
    expect(offer.removeCounterCandidates).toEqual([bears]);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, removeCounter: [bears, bears], targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('naming it twice when it carries only one is refused', () => {
    const { g, self, bears, ring } = armedInitiate(1);
    // One counter on the board and a count of two: not offered at all.
    expect(offerFor(g, self)).toBeUndefined();
    const bad = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, removeCounter: [bears, bears], targets: [{ kind: 'card', id: ring }] });
    expect(bad.ok).toBe(false);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(1);
  });
});
