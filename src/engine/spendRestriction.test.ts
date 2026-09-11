// D397 - SPEND-RESTRICTED MANA. "Spend this mana only to cast a creature spell" (Ancient
// Ziggurat) was a CONDITIONAL source: excluded from auto-tap, tapped by hand, the restriction
// the player's - and the accounting refused the card, because a bot would spend the mana on
// anything. The parser reads the restriction now (`parseSpendRestriction`), the pool keeps the
// mana in a SUB-POOL keyed by the printed sentence (`PlayerState.poolRestricted`), and the
// payment path asks with a PURPOSE: `fitFor` subtracts every bucket and drops every source the
// purpose does not fit before the solver runs (the inverse of D364's snow reservation - snow is
// mana a cost DEMANDS, a restriction is mana a cost CANNOT USE).

import { describe, expect, test } from 'vitest';
import { engineCompleteness } from '../data/engineComplete';
import { parseFace, parseSpendRestriction } from '../data/oracleParse';
import {
  ANCIENT_ZIGGURAT,
  CASTLE_GARENBRIG,
  ELDRAZI_TEMPLE,
  ELFHAME_DRUID,
  MISHRA_S_WORKSHOP,
  OMEN_HAWKER,
  SAGE_OF_THE_UNKNOWABLE,
  VODALIAN_ARCANIST,
} from '../data/fixtures/engineCards';
import { checkInvariants } from './invariants';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { buildPaymentProblem } from './mana';
import { affordable, fitFor, suggestPayment } from './payment';
import { OTHER_PURPOSE, abilityPurpose, restrictionAllows, spellPurpose } from './spend';
import { advanceUntil, must, put, startedGame } from './testing/harness';
import { EMPTY_POOL } from './types/mana';
import { parseManaCost } from '../data/oracleParse';
import type { Game } from './game';
import type { ManaSource } from './mana';
import type { SolveInput } from './payment';
import type { SpendPurpose } from './spend';
import type { SpendRestriction } from './types/mana';

const problemFor = (raw: string) => buildPaymentProblem(parseManaCost(raw), 0, [], 0, 0);

/** The restriction a fixture's restricted line carries. */
function restrictionOf(card: typeof ANCIENT_ZIGGURAT): SpendRestriction {
  const face = parseFace(card, 0);
  const p = face.producesMana.find((x) => x.line !== null && x.restriction);
  if (!p?.restriction) throw new Error(`${card.name} carries no read restriction`);
  return p.restriction;
}

const CREATURE_SPELL: SpendPurpose = { kind: 'spell', types: ['Creature'], subtypes: ['Bear'], supertypes: [], colors: ['G'] };
const INSTANT: SpendPurpose = { kind: 'spell', types: ['Instant'], subtypes: [], supertypes: [], colors: ['R'] };
const DEVOID_ELDRAZI: SpendPurpose = { kind: 'spell', types: ['Creature'], subtypes: ['Eldrazi', 'Drone'], supertypes: [], colors: [] };
const RED_ELDRAZI: SpendPurpose = { kind: 'spell', types: ['Creature'], subtypes: ['Eldrazi'], supertypes: [], colors: ['R'] };
const ARTIFACT_ABILITY: SpendPurpose = { kind: 'ability', types: ['Artifact'], subtypes: [], supertypes: [], colors: [] };
const ELDRAZI_ABILITY: SpendPurpose = { kind: 'ability', types: ['Creature'], subtypes: ['Eldrazi'], supertypes: [], colors: [] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

describe('D397 - the restriction, parsed', () => {
  test('one alternative, a type: a creature spell', () => {
    const r = restrictionOf(ANCIENT_ZIGGURAT);
    expect(r.spells).toEqual([[{ kind: 'type', value: 'Creature' }]]);
    expect(r.abilities).toBeNull();
    expect(r.text).toBe('Spend this mana only to cast a creature spell.');
    const face = parseFace(ANCIENT_ZIGGURAT, 0);
    // The line is no longer conditional: the payment path enforces the restriction now.
    expect(face.producesMana.filter((p) => p.line !== null).map((p) => p.conditional)).toEqual([false]);
  });

  test('a conjunction on both sides: colorless Eldrazi spells or abilities of colorless Eldrazi', () => {
    const r = restrictionOf(ELDRAZI_TEMPLE);
    expect(r.spells).toEqual([[{ kind: 'colorless' }, { kind: 'subtype', value: 'Eldrazi' }]]);
    expect(r.abilities).toEqual([[{ kind: 'colorless' }, { kind: 'subtype', value: 'Eldrazi' }]]);
  });

  test('any ability, no spell at all: Omen Hawker', () => {
    const r = restrictionOf(OMEN_HAWKER);
    expect(r.spells).toBeNull();
    expect(r.abilities).toEqual([[]]);
  });

  test('a colorless spell or any ability: Sage of the Unknowable', () => {
    const r = restrictionOf(SAGE_OF_THE_UNKNOWABLE);
    expect(r.spells).toEqual([[{ kind: 'colorless' }]]);
    expect(r.abilities).toEqual([[]]);
  });

  test('lists read as alternatives and the count word multiplies the symbol: Castle Garenbrig', () => {
    const face = parseFace(CASTLE_GARENBRIG, 0);
    const six = face.producesMana.find((p) => p.restriction);
    expect(six?.outputs).toEqual([{ mana: { ...EMPTY_POOL, G: 6 }, amount: 6 }]);
    expect(six?.extraCost?.mana?.raw).toBe('{2}{G}{G}');
    expect(six?.conditional).toBe(false);
    expect(six?.restriction?.spells).toEqual([[{ kind: 'type', value: 'Creature' }]]);
    expect(six?.restriction?.abilities).toEqual([[{ kind: 'type', value: 'Creature' }]]);
    const list = parseSpendRestriction('Spend this mana only to cast a Knight or Equipment spell.');
    expect(list?.spells).toEqual([[{ kind: 'subtype', value: 'Knight' }], [{ kind: 'subtype', value: 'Equipment' }]]);
    const andOr = parseSpendRestriction('Spend this mana only to cast Vampire, Cleric, and/or Demon spells.');
    expect(andOr?.spells?.map((c) => c.map((t) => (t.kind === 'subtype' ? t.value : t.kind)))).toEqual([['Vampire'], ['Cleric'], ['Demon']]);
    const plural = parseSpendRestriction('Spend this mana only to cast Elemental spells or activate abilities of Elementals.');
    expect(plural?.abilities).toEqual([[{ kind: 'subtype', value: 'Elemental' }]]);
    const chandra = parseSpendRestriction('Spend this mana only to cast an Elemental spell or a Chandra planeswalker spell.');
    expect(chandra?.spells).toEqual([[{ kind: 'subtype', value: 'Elemental' }], [{ kind: 'subtype', value: 'Chandra' }, { kind: 'type', value: 'Planeswalker' }]]);
  });

  test('a restriction the reader cannot express leaves the line conditional and unread', () => {
    expect(parseSpendRestriction('Spend this mana only to cast kicked spells.')).toBeNull();
    expect(parseSpendRestriction('Spend this mana only to cast spells you don\'t own.')).toBeNull();
    expect(parseSpendRestriction('Spend this mana only on costs that contain {X}.')).toBeNull();
    expect(parseSpendRestriction('Spend this mana only to pay cumulative upkeep costs.')).toBeNull();
    const druid = parseFace(ELFHAME_DRUID, 0);
    const kicked = druid.producesMana.find((p) => /Spend this mana/.test(p.text));
    expect(kicked?.conditional).toBe(true);
    expect(kicked?.restriction ?? null).toBeNull();
  });
});

describe('D397 - the accounting', () => {
  test('a restricted line the engine enforces is a line the engine runs', () => {
    for (const card of [ANCIENT_ZIGGURAT, ELDRAZI_TEMPLE, OMEN_HAWKER, SAGE_OF_THE_UNKNOWABLE, CASTLE_GARENBRIG, VODALIAN_ARCANIST, MISHRA_S_WORKSHOP]) {
      const c = engineCompleteness(card);
      expect(c.complete, `${card.name}: ${JSON.stringify(c.leftover)}`).toBe(true);
    }
  });

  test('a restriction the reader cannot express keeps the card incomplete', () => {
    expect(engineCompleteness(ELFHAME_DRUID).complete).toBe(false);
  });
});

describe('D397 - what a restriction allows', () => {
  test('a creature spell, a face-down spell, an instant, an ability, and nothing else', () => {
    const r = restrictionOf(ANCIENT_ZIGGURAT);
    expect(restrictionAllows(r, CREATURE_SPELL)).toBe(true);
    // A face-down spell is a colourless creature spell with no subtypes (CR 708.2).
    expect(restrictionAllows(r, spellPurpose(parseFace(ELFHAME_DRUID, 0), true))).toBe(true);
    expect(restrictionAllows(r, INSTANT)).toBe(false);
    expect(restrictionAllows(r, ARTIFACT_ABILITY)).toBe(false);
    expect(restrictionAllows(r, OTHER_PURPOSE)).toBe(false);
  });

  test('a conjunction needs every term: colorless AND Eldrazi, for a spell or a source', () => {
    const r = restrictionOf(ELDRAZI_TEMPLE);
    expect(restrictionAllows(r, DEVOID_ELDRAZI)).toBe(true);
    expect(restrictionAllows(r, RED_ELDRAZI)).toBe(false);
    expect(restrictionAllows(r, ELDRAZI_ABILITY)).toBe(true);
    expect(restrictionAllows(r, ARTIFACT_ABILITY)).toBe(false);
  });

  test('an empty conjunction is any ability - and never a spell', () => {
    const r = restrictionOf(OMEN_HAWKER);
    expect(restrictionAllows(r, ARTIFACT_ABILITY)).toBe(true);
    expect(restrictionAllows(r, ELDRAZI_ABILITY)).toBe(true);
    expect(restrictionAllows(r, CREATURE_SPELL)).toBe(false);
    expect(restrictionAllows(r, OTHER_PURPOSE)).toBe(false);
  });

  test('a devoid face is a colourless spell and an ability purpose reads its source', () => {
    const sage = restrictionOf(SAGE_OF_THE_UNKNOWABLE);
    const druid = parseFace(ELFHAME_DRUID, 0);
    expect(restrictionAllows(sage, spellPurpose(druid, false))).toBe(false); // a green creature
    expect(restrictionAllows(sage, abilityPurpose(druid.typeLine, ['G']))).toBe(true); // any ability
  });
});

describe('D397 - the payment path', () => {
  const ziggurat = restrictionOf(ANCIENT_ZIGGURAT);
  const held: SolveInput = {
    pool: { ...EMPTY_POOL, G: 2 },
    poolSnow: EMPTY_POOL,
    poolRestricted: [{ restriction: ziggurat, mana: { ...EMPTY_POOL, G: 2 } }],
    sources: [],
    lifeAvailable: 40,
    eventCount: 0,
  };
  const source = (card: string, restriction: SpendRestriction | null): ManaSource => ({
    card,
    abilityIndex: 0,
    outputs: [{ mana: { ...EMPTY_POOL, G: 1 }, amount: 1 }],
    requiresTap: true,
    conditional: false,
    snow: false,
    restriction,
    flexibilityRank: restriction ? -1 : 0,
  });

  test('restricted mana in the pool pays what it may and nothing else', () => {
    expect(affordable(held, problemFor('{1}{G}'), CREATURE_SPELL)).toBe(true);
    expect(affordable(held, problemFor('{1}{G}'), INSTANT)).toBe(false);
    expect(affordable(held, problemFor('{1}{G}'), OTHER_PURPOSE)).toBe(false);
    // A caller that says nothing gets the safe direction: the bucket is withheld.
    expect(affordable(held, problemFor('{G}'))).toBe(false);
    expect(fitFor(held, INSTANT).pool).toEqual(EMPTY_POOL);
    expect(fitFor(held, CREATURE_SPELL)).toBe(held);
  });

  test('a restricted source is tapped for a fitting purpose and dropped for any other', () => {
    const board: SolveInput = { ...held, pool: EMPTY_POOL, poolRestricted: [], sources: [source('zig', ziggurat)] };
    const creature = suggestPayment(board, problemFor('{G}'), CREATURE_SPELL);
    expect(creature?.taps.map((t) => t.source)).toEqual(['zig']);
    expect(suggestPayment(board, problemFor('{G}'), INSTANT)).toBeNull();
    expect(suggestPayment(board, problemFor('{G}'))).toBeNull();
    // Beside an ordinary Forest the restricted source is spent FIRST for a creature - it is the
    // less flexible mana - and the Forest alone pays for the instant.
    const both: SolveInput = { ...board, sources: [source('forest', null), source('zig', ziggurat)] };
    expect(suggestPayment(both, problemFor('{G}'), CREATURE_SPELL)?.taps.map((t) => t.source)).toEqual(['zig']);
    expect(suggestPayment(both, problemFor('{G}'), INSTANT)?.taps.map((t) => t.source)).toEqual(['forest']);
  });
});

describe('D397 - in play', () => {
  test('two Ziggurats fund a creature and not an instant; the buckets fill, drain and empty', () => {
    const g = startedGame({ players: 2, decks: [['Ancient Ziggurat', 'Ancient Ziggurat', 'Grizzly Bears', 'Lightning Bolt'], ['Grizzly Bears']] });
    const zig1 = put(g, 'p1', 'Ancient Ziggurat');
    const zig2 = put(g, 'p1', 'Ancient Ziggurat');
    expect(zig1).not.toBe(zig2);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    const shock = put(g, 'p1', 'Lightning Bolt', 'hand');
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const offers = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1');
    const castBears = offers.find((a) => a.t === 'CastSpell' && a.card === bears);
    const castShock = offers.find((a) => a.t === 'CastSpell' && a.card === shock);
    expect(castBears?.t === 'CastSpell' && castBears.affordable, 'the creature is affordable from restricted sources').toBe(true);
    expect(castShock?.t === 'CastSpell' && castShock.affordable, 'the instant is not').toBe(false);
    // The restricted sources are still offered to the hand, and say what they are for.
    const tap = offers.find((a) => a.t === 'TapForMana' && a.card === zig1);
    expect(tap?.t === 'TapForMana' && tap.conditional).toBe(false);

    // Tap one by hand: the mana lands in a bucket, the invariants hold, and the instant is still out of reach.
    const gIndex = tap?.t === 'TapForMana' ? tap.outputs.indexOf('{R}') : -1;
    expect(gIndex).toBeGreaterThanOrEqual(0);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: zig1, abilityIndex: 0, outputChoice: gIndex }));
    const p1 = g.state.players.p1!;
    expect(p1.pool.R).toBe(1);
    expect(p1.poolRestricted).toEqual([{ restriction: expect.objectContaining({ text: 'Spend this mana only to cast a creature spell.' }), mana: { ...EMPTY_POOL, R: 1 } }]);
    expect(checkInvariants(g.state)).toEqual([]);
    const shockNow = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === shock);
    expect(shockNow?.t === 'CastSpell' && shockNow.affordable, 'a red mana in the pool that may not pay for an instant').toBe(false);
    // A plan written by hand that spends the restricted mana on the instant is refused.
    const refused = g.submit({ t: 'CastSpell', player: 'p1', card: shock, targets: [{ kind: 'player', id: 'p2' }], plan: { taps: [], spendFromPool: { ...EMPTY_POOL, R: 1 }, hybridChoices: [], lifePaid: 0, forEventCount: g.state.eventCount } });
    expect(refused.ok).toBe(false);

    // The creature: the solver taps the second Ziggurat, the spend draws on the bucket, the bucket is gone.
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    const spent = g.log.filter((e) => e.body.t === 'ManaSpent').at(-1)?.body;
    expect(spent?.t === 'ManaSpent' && spent.restricted.length).toBe(1);
    expect(g.log.filter((e) => e.body.t === 'ManaAdded' && e.body.only !== undefined)).toHaveLength(2);
    expect(g.state.players.p1?.poolRestricted).toEqual([]);
    expect(g.state.players.p1?.pool).toEqual(EMPTY_POOL);
    expect(checkInvariants(g.state)).toEqual([]);
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('ordinary mana beside restricted mana: the instant spends the ordinary and leaves the bucket', () => {
    const g = startedGame({ players: 2, decks: [['Ancient Ziggurat', 'Lightning Bolt'], ['Grizzly Bears']] });
    const zig = put(g, 'p1', 'Ancient Ziggurat');
    const shock = put(g, 'p1', 'Lightning Bolt', 'hand');
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const tap = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'TapForMana' && a.card === zig);
    const rIndex = tap?.t === 'TapForMana' ? tap.outputs.indexOf('{R}') : -1;
    must(g.submit({ t: 'TapForMana', player: 'p1', card: zig, abilityIndex: 0, outputChoice: rIndex }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    expect(g.state.players.p1?.pool.R).toBe(2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shock, targets: [{ kind: 'player', id: 'p2' }] }));
    const spent = g.log.filter((e) => e.body.t === 'ManaSpent').at(-1)?.body;
    expect(spent?.t === 'ManaSpent' && spent.restricted).toEqual([]);
    expect(g.state.players.p1?.pool.R).toBe(1);
    expect(g.state.players.p1?.poolRestricted).toEqual([{ restriction: expect.objectContaining({ text: 'Spend this mana only to cast a creature spell.' }), mana: { ...EMPTY_POOL, R: 1 } }]);
    expect(checkInvariants(g.state)).toEqual([]);
    settle(g);
    expect(g.state.players.p2?.life).toBe(37);
    // The step boundary empties the pool and its buckets together.
    advanceUntil(g, (s) => s.turn.phase !== 'precombatMain', 20_000);
    expect(g.state.players.p1?.pool).toEqual(EMPTY_POOL);
    expect(g.state.players.p1?.poolRestricted).toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Omen Hawker's mana activates a cycling and never casts a creature; Ziggurat mana does the reverse", () => {
    const g = startedGame({ players: 2, decks: [['Omen Hawker', 'Ancient Ziggurat', 'Lonely Sandbar', 'Grizzly Bears'], ['Grizzly Bears']] });
    const hawker = put(g, 'p1', 'Omen Hawker');
    const zig = put(g, 'p1', 'Ancient Ziggurat');
    const sandbar = put(g, 'p1', 'Lonely Sandbar', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    settle(g);
    const t0 = g.state.turn.turnNumber;
    // Past summoning sickness by p1's next turn.
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const offers = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1');
    const hawkerTap = offers.find((a) => a.t === 'TapForMana' && a.card === hawker);
    expect(hawkerTap?.t).toBe('TapForMana');
    must(g.submit({ t: 'TapForMana', player: 'p1', card: hawker, abilityIndex: 0, outputChoice: 0 }));
    const after = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1');
    const cycle = after.find((a) => a.t === 'ActivateAbility' && a.card === sandbar);
    const cast = after.find((a) => a.t === 'CastSpell' && a.card === bears);
    expect(cycle?.t === 'ActivateAbility' && cycle.affordable, "the Hawker's mana pays for an ability").toBe(true);
    expect(cast?.t === 'CastSpell' && cast.affordable, 'and never for a creature spell').toBe(false);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sandbar, abilityIndex: cycle?.t === 'ActivateAbility' ? cycle.abilityIndex : 0 }));
    const spent = g.log.filter((e) => e.body.t === 'ManaSpent').at(-1)?.body;
    expect(spent?.t === 'ManaSpent' && spent.restricted.length).toBe(1);
    settle(g);
    expect(g.state.cards[sandbar]?.zone.kind).toBe('graveyard');
    expect(checkInvariants(g.state)).toEqual([]);
    // The Ziggurat: its mana casts the creature, and in the pool it would not pay for a cycling.
    const zigTap = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'TapForMana' && a.card === zig);
    const gIndex = zigTap?.t === 'TapForMana' ? zigTap.outputs.indexOf('{G}') : -1;
    must(g.submit({ t: 'TapForMana', player: 'p1', card: zig, abilityIndex: 0, outputChoice: gIndex }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    const last = g.log.filter((e) => e.body.t === 'ManaSpent').at(-1)?.body;
    expect(last?.t === 'ManaSpent' && last.restricted).toEqual([{ restriction: expect.objectContaining({ text: 'Spend this mana only to cast a creature spell.' }), mana: { ...EMPTY_POOL, G: 1 } }]);
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
