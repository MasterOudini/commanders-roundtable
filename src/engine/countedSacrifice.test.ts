// D353 — THE COUNTED SACRIFICE, and the self counter beside it.
//
// The sacrifice chooser has charged `Sacrifice a|an|another <predicate>` since D168 and NOTHING
// counted, though the discard and tap choosers beside it have carried a count since D286 — so
// `Sacrifice two lands` was a cost the engine refused for the sake of one word. It counts now,
// the intent carries a LIST rather than one id, and the host re-validates every pick with the
// same predicate `legal.ts` offered by.
//
// ⚠️ The parse half is here in full. The charge is proven on the batch's own generated rows,
// which activate through the real offer and read the graveyard afterwards.

import { describe, expect, test } from 'vitest';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';

const parse = (text: string, selfName?: string) =>
  parseActivatedAbilities({
    oracleText: text,
    isPermanent: true,
    producesMana: [],
    parseCost: (raw) => parseManaCost(raw),
    ...(selfName === undefined ? {} : { selfName }),
  });

describe('D353 - the counted sacrifice, parsed', () => {
  test('"Sacrifice two lands" is the chooser with a count', () => {
    const [a] = parse('{1}, Sacrifice two lands: Destroy target land.');
    expect(a?.sacrificeCost).toEqual({ count: 2, another: false, any: [{ supertypes: [], types: ['Land'], subtypes: [], colors: [] }] });
    expect(a?.unpaidCosts).toEqual([]);
    expect(a?.payable).toBe(true);
    expect(a?.manaCost?.generic).toBe(1);
  });

  test('the plural is read back to the singular before the predicate grammar', () => {
    const [a] = parse('{R}, Sacrifice two artifacts: Destroy target artifact.');
    expect(a?.sacrificeCost?.any).toEqual([{ supertypes: [], types: ['Artifact'], subtypes: [], colors: [] }]);
    const [b] = parse('{T}, Sacrifice two creatures: Draw a card.');
    expect(b?.sacrificeCost?.any).toEqual([{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }]);
    const [c] = parse('{2}{W}, Sacrifice two enchantments: Draw a card.');
    expect(c?.sacrificeCost?.any).toEqual([{ supertypes: [], types: ['Enchantment'], subtypes: [], colors: [] }]);
  });

  test('a subtype counts too, and three is a count like two', () => {
    const [a] = parse('{2}{R}, Sacrifice two Goblins: Draw a card.');
    expect(a?.sacrificeCost).toEqual({ count: 2, another: false, any: [{ supertypes: [], types: [], subtypes: ['Goblin'], colors: [] }] });
    const [b] = parse('Sacrifice three Treasures: Draw a card.');
    expect(b?.sacrificeCost?.count).toBe(3);
    expect(b?.sacrificeCost?.any).toEqual([{ supertypes: [], types: [], subtypes: ['Treasure'], colors: [] }]);
    expect(b?.payable).toBe(true);
  });

  test('"two other creatures" keeps BOTH the count and the exclusion', () => {
    const [a] = parse('{2}{B}, Sacrifice two other creatures: Destroy target creature.');
    expect(a?.sacrificeCost?.count).toBe(2);
    expect(a?.sacrificeCost?.another).toBe(true);
    expect(a?.sacrificeCost?.any).toEqual([{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }]);
  });

  test('a token predicate counts (D328 one word over)', () => {
    const [a] = parse('{B}, Sacrifice two Blood tokens: Draw a card.');
    expect(a?.sacrificeCost?.count).toBe(2);
    expect(a?.payable).toBe(true);
  });

  // ⚠️ THE SINGULAR IS UNCHANGED, and that is the assertion: a decision that
  // re-shaped the field must leave every card the engine already charged
  // charging exactly as before.
  test('the singular reads count 1, and "another" still excludes the source', () => {
    const [a] = parse('{2}{B}, Sacrifice a creature: Create two Treasure tokens.');
    expect(a?.sacrificeCost).toEqual({ count: 1, another: false, any: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }] });
    const [b] = parse('{B}, Sacrifice another creature: Regenerate this creature.');
    expect(b?.sacrificeCost).toEqual({ count: 1, another: true, any: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }] });
    const [c] = parse('{T}, Sacrifice a permanent: Draw a card.');
    expect(c?.sacrificeCost?.count).toBe(1);
    expect(c?.sacrificeCost?.any).toEqual([{ supertypes: [], types: [], subtypes: [], colors: [] }]);
  });

  // ⚠️ A COMPOUND IS TWO PRICES IN ONE PHRASE and stays unpaid: reading it as
  // "two lands" would charge half the cost and leave the artifact standing.
  test('a compound cost stays unpaid', () => {
    const [a] = parse('Sacrifice two lands and this artifact: Draw a card.');
    expect(a?.sacrificeCost).toBeNull();
    expect(a?.payable).toBe(false);
    expect(a?.unpaidCosts).toEqual(['Sacrifice two lands and this artifact']);
  });

  test('a phrase outside the predicate grammar stays unpaid', () => {
    const [a] = parse('{1}, Sacrifice two creatures with power 4 or greater: Draw a card.');
    expect(a?.sacrificeCost).toBeNull();
    expect(a?.payable).toBe(false);
  });

  test('the self-sacrifice is not the chooser', () => {
    const [a] = parse('{2}, Sacrifice this creature: Draw a card.');
    expect(a?.sacrificesSelf).toBe(true);
    expect(a?.sacrificeCost).toBeNull();
    expect(a?.payable).toBe(true);
  });
});

describe('D353 - the self counter, parsed', () => {
  test('"Put a -1/-1 counter on this creature" is a price the engine takes', () => {
    const [a] = parse('Put a -1/-1 counter on this creature: Untap this creature.');
    expect(a?.putCounterCost).toEqual({ kind: '-1/-1', count: 1 });
    expect(a?.unpaidCosts).toEqual([]);
    expect(a?.payable).toBe(true);
  });

  test('an older printing names the card itself', () => {
    const [a] = parse('Put a -1/-1 counter on Devoted Druid: Untap Devoted Druid.', 'Devoted Druid');
    expect(a?.putCounterCost).toEqual({ kind: '-1/-1', count: 1 });
    expect(a?.payable).toBe(true);
  });

  // ⚠️ SELF ONLY, the remove-a-counter cost's own boundary (D319): "on a
  // creature you control" is a decision, and a decision needs a chooser.
  test('"on a creature you control" is a decision and stays unpaid', () => {
    const [a] = parse('{1}, Put a -1/-1 counter on a creature you control: Draw a card.');
    expect(a?.putCounterCost).toBeNull();
    expect(a?.payable).toBe(false);
    expect(a?.unpaidCosts).toEqual(['Put a -1/-1 counter on a creature you control']);
  });

  test('a plain mana ability stays what it was', () => {
    const [a] = parse('{T}: Add {G}.');
    expect(a?.sacrificeCost).toBeNull();
    expect(a?.putCounterCost).toBeNull();
    expect(a?.payable).toBe(true);
  });
});

// ── the charge ────────────────────────────────────────────────────────────────
//
// ⚠️ Proven through the REAL offer and the real intent, on two cards this batch
// landed: Keldon Arsonist eats two lands for one land, Devoted Druid pays a
// counter to straighten itself.

import { legalActions } from './legal';
import { createRegistry } from './scripts/registryCore';
import { KELDON_ARSONIST_SCRIPT } from './scripts/cards/keldonArsonist';
import { DEVOTED_DRUID_SCRIPT } from './scripts/cards/devotedDruid';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armedArsonist(forests: number): { g: Game; self: InstanceId; lands: InstanceId[]; target: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Keldon Arsonist', 'Forest', 'Forest', 'Forest'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([KELDON_ARSONIST_SCRIPT]),
  });
  holdEverywhere(g);
  const lands: InstanceId[] = [];
  for (let i = 0; i < forests; i++) lands.push(put(g, 'p1', 'Forest'));
  const target = put(g, 'p1', 'Forest');
  settle(g);
  const self = put(g, 'p1', 'Keldon Arsonist');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, self, lands, target };
}

const offerFor = (g: Game, self: InstanceId) =>
  legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'ActivateAbility' && a.card === self);

describe('D353 - the counted sacrifice, offered and charged (Keldon Arsonist)', () => {
  test('the offer names the candidates AND the count', () => {
    const { g, self } = armedArsonist(2);
    const offer = offerFor(g, self);
    expect(offer && offer.t === 'ActivateAbility' ? offer.sacrificeCount : undefined).toBe(2);
    const candidates = offer && offer.t === 'ActivateAbility' ? (offer.sacrificeCandidates ?? []) : [];
    expect(candidates.length).toBeGreaterThanOrEqual(3);
  });

  // ⚠️ FEWER CANDIDATES THAN THE COUNT IS NOT AN OFFER — the rule every chooser
  // here keeps, and the one a count makes reachable for the first time.
  test('with one land on the board the ability is not offered at all', () => {
    const { g, self } = armedArsonist(0);
    expect(offerFor(g, self)).toBeUndefined();
  });

  test('both lands die in ONE batch, and the target land is destroyed', () => {
    const { g, self, lands, target } = armedArsonist(2);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: self,
      abilityIndex: 0,
      sacrifice: [lands[0] as InstanceId, lands[1] as InstanceId],
      targets: [{ kind: 'card', id: target }],
    }));
    settle(g);
    for (const l of lands) expect(g.state.cards[l]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
  });

  // ⚠️ THE HOST RE-VALIDATES: too few, too many, and the same land twice.
  test('a wrong number of picks is refused, and so is naming one land twice', () => {
    const { g, self, lands, target } = armedArsonist(2);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const one = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: self,
      abilityIndex: 0,
      sacrifice: [lands[0] as InstanceId],
      targets: [{ kind: 'card', id: target }],
    });
    expect(one.ok).toBe(false);
    if (!one.ok) expect(one.reason).toBe('needsSacrifice');
    const twice = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: self,
      abilityIndex: 0,
      sacrifice: [lands[0] as InstanceId, lands[0] as InstanceId],
      targets: [{ kind: 'card', id: target }],
    });
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.reason).toBe('noSuchCard');
    expect(g.state.cards[lands[0] as InstanceId]?.zone.kind).toBe('battlefield');
  });
});

describe('D353 - the self counter, charged (Devoted Druid)', () => {
  test('the counter goes ON as the cost is paid, and the Druid straightens', () => {
    const g = startedGame({
      players: 2,
      decks: [['Devoted Druid'], ['Cyclops of One-Eyed Pass']],
      scripts: createRegistry([DEVOTED_DRUID_SCRIPT]),
    });
    holdEverywhere(g);
    const self = put(g, 'p1', 'Devoted Druid');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: true }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[self]?.counters['-1/-1'] ?? 0).toBe(1);
    expect(g.state.cards[self]?.tapped).toBe(false);
  });
});
