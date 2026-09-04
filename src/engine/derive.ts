// The CR layer pipeline. Three layers live in v1; the seams for the rest exist
// and cost nothing until a card script uses them.
//
// ⚠️ DERIVED CHARACTERISTICS ARE NEVER STORED. Power, toughness, keywords and
// types are computed here on demand, every time. Caching them in `CardInstance`
// would mean every effect that changes one has to remember to recompute the
// others, which is exactly how a rules engine ends up with a 3/3 that dies to 2
// damage. The cost is bounded by `makeDeriveCache`, which memoises for the
// duration of ONE pass and is invalidated by `state.eventCount` — so an SBA
// sweep over 84 permanents derives each of them once, not once per check.

import type { ColorLetter } from '../data/cardTypes';
import { parseTypeLine } from '../data/oracleParse';
import { faceOf } from './oracle';
import type { ScriptRegistry } from './scripts/registry';
import type { MutableCharacteristics, ScriptCtx, StaticDef } from './scripts/api';
import type { InstanceId } from './types/ids';
import type { DerivedCharacteristics, Keyword, OracleDb, ParsedTypeLine } from './types/oracle';
import { NO_PROTECTION } from './types/oracle';
import type { CardInstance, GameState } from './types/state';

const FACE_DOWN_TYPE: ParsedTypeLine = {
  supertypes: [],
  types: ['Creature'],
  subtypes: [],
  raw: 'Creature',
};

const EMPTY_TYPE: ParsedTypeLine = { supertypes: [], types: [], subtypes: [], raw: '' };

/** One live source of a continuous effect, already matched to its def. */
interface StaticSource {
  readonly sourceId: InstanceId;
  readonly def: StaticDef;
}

export interface DeriveCache {
  eventCount: number;
  map: Map<InstanceId, DerivedCharacteristics>;
  /**
   * Which permanents on the battlefield actually have a static in each layer,
   * built once per (cache, layer) instead of once per object per layer.
   *
   * ⚠️ **THIS IS THE O(N²) D129 MEASURED AND DEFERRED.** `applyStatics` walked
   * the whole battlefield for every object, in every layer, on every derive —
   * so an SBA sweep over N permanents did N × layers × N instance comparisons.
   * With two registered statics that was **+64%** on the fuzz gate (33.6 s →
   * 55.2 s at 60 seeds); with a real card library it is the shape of the whole
   * layer system. D129's own comment named this index as the fix and said to
   * build it before M6.4 lands statics at scale.
   *
   * ⚠️ Keyed to the cache, so it is invalidated exactly when the derived
   * characteristics are — by `state.eventCount`. A source that entered or left
   * the battlefield changed the event count, so a stale index cannot outlive
   * the board it describes. That is also why it is NOT a field on `GameState`:
   * it is a memo, not a fact about the game.
   */
  staticSources: Map<string, readonly StaticSource[]>;
}

export function makeDeriveCache(state: GameState): DeriveCache {
  return { eventCount: state.eventCount, map: new Map(), staticSources: new Map() };
}

/**
 * Characteristics of one object, after the layers.
 *
 * `cache` is optional so a one-off call is easy, and worth passing whenever
 * more than a couple of objects are examined in the same pass.
 */
export function derive(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  id: InstanceId,
  cache?: DeriveCache,
): DerivedCharacteristics {
  if (cache) {
    if (cache.eventCount !== state.eventCount) {
      cache.eventCount = state.eventCount;
      cache.map.clear();
    }
    const hit = cache.map.get(id);
    if (hit) return hit;
  }
  const result = computeDerived(state, oracle, scripts, id, cache);
  cache?.map.set(id, result);
  return result;
}

function computeDerived(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  id: InstanceId,
  cache: DeriveCache | undefined,
): DerivedCharacteristics {
  const inst = state.cards[id];
  if (!inst) {
    return finish({
      name: '',
      typeLine: EMPTY_TYPE,
      colors: [],
      power: null,
      toughness: null,
      loyalty: null,
      defense: null,
      keywords: new Set<Keyword>(),
      hasAbilities: true,
      protection: NO_PROTECTION,
      landwalk: [],
      toxicAmount: 0,
    }, 0, []);
  }

  const chars = layerOne(inst, oracle);

  // Layer 4 — type-changing. Only the Tier-3 manual override in v1.
  if (inst.typeOverride !== null) chars.typeLine = parseTypeLine(inst.typeOverride);

  // Layer 6 — ability adding/removing. Card scripts only; none ship.
  //
  // ⚠️ It has always RUN; what it lacked was an ORDER. See `applyStatics` for
  // why the battlefield array is the timestamp (CR 613.7c) and D129 for the two
  // re-timestamping clauses and the dependency rule it does not implement.
  applyStatics(state, oracle, scripts, inst, chars, 'ability', cache);
  // ⚠️ **TEMPORARY KEYWORD GRANTS (D194)** — the carrier D153 measured missing
  // under 958 sole-need cards: `untilEndOfTurn` held power and toughness and
  // nothing else, so no spell or script could grant flying for a turn. The
  // grants land HERE, in layer 6 where CR puts ability-adding, AFTER the
  // statics.
  //
  // ⚠️ THE ORDERING ARGUMENT, stated because it is a scope decision: CR 613.7c
  // gives a one-shot effect its own timestamp (when it was created), and this
  // engine's layer-6 timestamp is the BATTLEFIELD ARRAY (D129) — the two are
  // not comparable, so a true merge needs per-effect sequence stamps. What
  // ships instead is additions-after-statics, which is EXACTLY right as long
  // as every layer-6 static in play is itself an ADDITION (additions commute)
  // — and every SHIPPED static is: the only ability-REMOVING statics in the
  // repo are testing scripts (Gravity Sphere, Humility). The day a removal
  // ships, this needs the real timestamp merge — that is the named
  // reportable, not a surprise.
  for (const mod of state.untilEndOfTurn) {
    if (mod.card !== inst.id || mod.keywords === undefined) continue;
    for (const k of mod.keywords) chars.keywords.add(k);
  }
  // D311 - layer 4: card types gained until end of turn (a crewed Vehicle is
  // an artifact creature; CR 702.122a).
  for (const mod of state.untilEndOfTurn) {
    if (mod.card !== inst.id || mod.types === undefined) continue;
    const types = [...chars.typeLine.types];
    for (const t of mod.types) if (!types.includes(t)) types.push(t);
    chars.typeLine = { ...chars.typeLine, types };
  }
  applyStatics(state, oracle, scripts, inst, chars, 'type', cache);
  applyStatics(state, oracle, scripts, inst, chars, 'color', cache);

  // Layer 7a — characteristic-defining P/T (`*`-power cards). A script sets it;
  // without one, `basePower` was already null and the card is 0/0. That is the
  // honest Tier-2 answer, and the SBA will bin it — which is visible, unlike a
  // silent guess of 1/1.
  applyStatics(state, oracle, scripts, inst, chars, 'cda', cache);

  // Layer 7b — setting base P/T.
  //
  // ⚠️ The Tier-3 override lands HERE, before counters, not after them. The
  // spec sketched it at 7d, but the player's intent when they type "4/4" into
  // the manual tool is "this creature's base is 4/4 now" — and a +1/+1 counter
  // must still make it a 5/5. Applying it after counters would make the counter
  // silently do nothing, which reads as a broken counter tool. See DECISIONS D34.
  if (inst.ptOverride !== null) {
    chars.power = inst.ptOverride.power;
    chars.toughness = inst.ptOverride.toughness;
  }
  applyStatics(state, oracle, scripts, inst, chars, 'ptSet', cache);

  // Layer 7c — P/T modifying effects (anthems, and "until end of turn").
  //
  // ⚠️ The until-end-of-turn list lands HERE, which is where CR puts it: after
  // the base-setting layer above and BEFORE counters below. That ordering is
  // what makes a Giant Growth on a creature with a +1/+1 counter read as +4/+4
  // rather than silently swallowing one of them, and it is the same reasoning
  // D34 records for why the Tier-3 override sits at 7b.
  for (const mod of state.untilEndOfTurn) {
    if (mod.card !== inst.id) continue;
    if (chars.power !== null) chars.power += mod.power;
    if (chars.toughness !== null) chars.toughness += mod.toughness;
  }
  applyStatics(state, oracle, scripts, inst, chars, 'ptModify', cache);

  // Layer 7d(ours) — counters. CR puts +1/+1 counters in 7d proper.
  const plus = inst.counters['+1/+1'] ?? 0;
  const minus = inst.counters['-1/-1'] ?? 0;
  if (chars.power !== null) chars.power += plus - minus;
  if (chars.toughness !== null) chars.toughness += plus - minus;

  applyStatics(state, oracle, scripts, inst, chars, 'ptSwitch', cache);

  const card = inst.faceDown ? undefined : oracle.byPrinting(inst.printingId);
  const manaValue = card?.manaValue ?? 0;
  const produces = inst.faceDown ? [] : (card ? faceOf(card, inst.faceIndex).producesMana : []);
  return finish(chars, manaValue, produces);
}

/** D310 - a changeling's type line: its own subtypes, then every creature type the database prints. */
function everyCreatureType(t: ParsedTypeLine, oracle: OracleDb): ParsedTypeLine {
  const extra: string[] = [];
  for (const sub of oracle.creatureTypes) if (!t.subtypes.includes(sub)) extra.push(sub);
  return extra.length === 0 ? t : { ...t, subtypes: [...t.subtypes, ...extra] };
}

function layerOne(inst: CardInstance, oracle: OracleDb): MutableCharacteristics {
  // CR 708.2: a face-down permanent is a 2/2 creature with no name, no mana
  // cost and no abilities — a genuinely different object, not a hidden one.
  // D309 - on the STACK as well: a face-down spell is a 2/2 creature spell with
  // no name and no color (CR 708.2), which is what a counter aimed at
  // "noncreature spell" and a prowess trigger must see.
  if (inst.faceDown && (inst.zone.kind === 'battlefield' || inst.zone.kind === 'stack')) {
    return {
      name: '',
      typeLine: FACE_DOWN_TYPE,
      colors: [],
      power: 2,
      toughness: 2,
      loyalty: null,
      defense: null,
      keywords: new Set<Keyword>(),
      // ⚠️ D309 - NO ABILITIES (CR 708.2). This one flag is what every reader
      // of a permanent's abilities already honours (CR 613's silence): the
      // trigger bus, the replacement funnel, the combat restrictions, the
      // activated offers. A face-down Hystrodon draws nothing.
      hasAbilities: false,
      protection: NO_PROTECTION,
      landwalk: [],
      toxicAmount: 0,
    };
  }
  const card = oracle.byPrinting(inst.printingId);
  if (!card) {
    // An unknown printing means the oracle db was built without this card.
    // Returning an inert object beats throwing: the game stays playable and the
    // card renders as a blank the player can move with a Tier-3 tool.
    return {
      name: '',
      typeLine: EMPTY_TYPE,
      colors: [],
      power: null,
      toughness: null,
      loyalty: null,
      defense: null,
      keywords: new Set<Keyword>(),
      hasAbilities: true,
      protection: NO_PROTECTION,
      landwalk: [],
      toxicAmount: 0,
    };
  }
  const face = faceOf(card, inst.faceIndex);
  return {
    name: face.name,
    // D310 - changeling: every creature type, a characteristic-defining
    // ability applied in layer 1 (CR 702.73a, 604.3).
    typeLine: face.keywords.includes('changeling') ? everyCreatureType(face.typeLine, oracle) : face.typeLine,
    // D310 - devoid: colorless, a characteristic-defining ability (CR 702.116a).
    colors: face.keywords.includes('devoid') ? [] : ([...face.colors] as ColorLetter[]),
    power: face.basePower,
    toughness: face.baseToughness,
    loyalty: face.baseLoyalty,
    defense: face.baseDefense,
    keywords: new Set<Keyword>(face.keywords),
    // ⚠️ LAYER ONE: a printed object HAS its abilities. Only a layer-6 effect
    // takes them away, which is why the default lives here and not in a
    // constructor default nobody would read.
    hasAbilities: true,
    protection: face.protection,
    landwalk: [...face.landwalk],
    toxicAmount: face.toxicAmount,
  };
}

/**
 * Run every registered static ability of one layer against this object, in
 * TIMESTAMP ORDER (CR 613.7).
 *
 * With `SHIPPED_REGISTRY` this is one `Map.get` returning a shared empty array and
 * a loop that does not run — which is the point of the design. Nothing here
 * asks whether the card is scripted.
 *
 * ⚠️ **THE BATTLEFIELD ARRAY IS THE TIMESTAMP**, and that is not a coincidence
 * this file may lean on quietly: `addToZone` APPENDS, and `removeFromZone`
 * takes a card out, so `state.zones.battlefield` is arrival order and a
 * permanent that leaves and re-enters goes to the back. That is exactly CR
 * 613.7c for a permanent entering the battlefield, and it is why no timestamp
 * field had to be added to `GameState` (which would have been a second source
 * of truth for the same fact, and part of the state hash). `zones.ts`'s order
 * convention is therefore load-bearing for the layer system — see D129.
 *
 * ⚠️ **THE SOURCE LOOP IS OUTERMOST, AND IT USED TO BE INNERMOST.** With the
 * defs outside, every source of the FIRST-REGISTERED script applied before any
 * source of the second — so `Levitation` (grant flying) against `Gravity
 * Sphere` (lose flying) was decided by registration order, which is an
 * implementation detail of the registry, rather than by which enchantment
 * entered the battlefield last, which is the rule. Invisible with zero scripts
 * registered, and wrong on the first pair that disagreed.
 *
 * ⚠️ **NOT COVERED, and deliberately:** CR 613.7d (an Aura or Equipment takes a
 * NEW timestamp when it becomes attached to a different object) and 613.7e (a
 * permanent turning face down). Neither changes the battlefield array, so a
 * re-attached Aura keeps its old position. And CR 613.8 DEPENDENCY is not built
 * at all. All three are stated in D129 with the rule that follows from them: a
 * card whose correctness needs one of them is not registered.
 */
function applyStatics(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  inst: CardInstance,
  chars: MutableCharacteristics,
  layer: Parameters<ScriptRegistry['staticsFor']>[0],
  cache: DeriveCache | undefined,
): void {
  const defs = scripts.staticsFor(layer);
  if (defs.length === 0) return;

  // ⚠️ **THE BATTLEFIELD WALK IS INDEXED NOW** (D147). It used to run here, once
  // per object per layer per derive — O(N²) across an SBA sweep, measured by
  // D129 at **+64%** on the fuzz gate with only two statics registered, and the
  // shape of the whole layer system once a real card library is loaded. What is
  // left below is a loop over the sources that ACTUALLY have a static in this
  // layer, which on any realistic board is a handful and usually none.
  //
  // ⚠️ The index is memoised on the `DeriveCache`, so it is invalidated by
  // exactly the same thing the derived characteristics are — `state.eventCount`.
  // A permanent that entered or left moved that number, so a stale index cannot
  // outlive its board.
  const sources = staticSourcesFor(state, scripts, cache, layer);
  if (sources.length === 0) return;

  // The context is built ON FIRST MATCH rather than per call, so a layer with
  // defs registered but no source in play allocates nothing.
  const ctx = makeScriptCtx(state, oracle, scripts);
  // ⚠️ CR 613.8 — DEPENDENCY OUTRANKS TIMESTAMP. See `dependencyOrder`.
  for (const { sourceId, def } of dependencyOrder(sources, ctx, inst.id, chars)) {
    // ⚠️ `chars` is handed over so `appliesTo` never has to derive the object
    // it is being asked about — which is unbounded recursion, because it is
    // running inside that object's own derive. See `StaticDef.appliesTo`.
    if (!def.appliesTo(ctx, sourceId, inst.id, chars)) continue;
    def.modify(chars, ctx, sourceId, inst.id);
  }
}

/**
 * A working copy of one object's characteristics, for asking "what would happen
 * if this other effect applied first".
 *
 * ⚠️ The mutable members are copied; `typeLine` and `protection` are replaced
 * wholesale by the effects that change them rather than mutated in place, so a
 * shallow copy of the record plus fresh `Set`/array for the three that ARE
 * mutated is the whole of it.
 */
function cloneChars(chars: MutableCharacteristics): MutableCharacteristics {
  return {
    ...chars,
    colors: [...chars.colors],
    keywords: new Set(chars.keywords),
    landwalk: [...chars.landwalk],
  };
}

/**
 * CR 613.8 — apply a layer's effects in DEPENDENCY order, falling back to
 * timestamp.
 *
 * 613.8a: A depends on B when applying B would change what A applies to (or what
 * it does to what it applies to). 613.8b: a dependent effect waits until after
 * everything it depends on; a dependency LOOP is ignored and its members go in
 * timestamp order.
 *
 * ⚠️ **THE REAL PAIR THIS EXISTS FOR** is `Knighthood` ("Creatures you control
 * have first strike") and `Kwende, Pride of Femeref` ("Creatures you control
 * with first strike have double strike"), both layer 6. Kwende DEPENDS on
 * Knighthood: whether Kwende applies to a creature is decided by whether
 * Knighthood has already granted it first strike. In timestamp order with Kwende
 * first, a vanilla creature ends with first strike and NO double strike — the
 * card doing nothing, silently, on a board where it plainly should.
 *
 * ⚠️ **WHAT IS BUILT IS 613.8a CLAUSE (b)'s FIRST HALF: "what it applies to",
 * evaluated for the object being derived.** That is a real question this engine
 * can answer cheaply and exactly — `appliesTo` is a predicate over `chars`, so
 * "would B change A's answer" is one clone and one call. The other half ("what it
 * DOES to the things it applies to") and "the text or existence of the first
 * effect" are NOT built: the second needs an effect that can remove another
 * script's static, which `MutableCharacteristics` cannot represent at all — it
 * models keywords, so `Humility` is unrepresentable rather than merely unwritten
 * (D129, D147).
 *
 * ⚠️ **613.8a CLAUSE (c) IS SATISFIED BY CONSTRUCTION HERE.** "Neither effect is
 * from a characteristic-defining ability or both are" — this runs WITHIN one
 * layer, `'cda'` is its own layer, so the two are always both or neither.
 *
 * ⚠️ O(k²) where k is the number of effects in this layer with a live source —
 * which is 0 on every board the shipped app has, and a handful on any real one.
 * The common case exits on the first line.
 */
function dependencyOrder(
  sources: readonly StaticSource[],
  ctx: ScriptCtx,
  self: InstanceId,
  chars: MutableCharacteristics,
): readonly StaticSource[] {
  if (sources.length < 2) return sources;

  /** Does `a` depend on `b`? — would applying b change a's verdict on `self`? */
  const dependsOn = (a: StaticSource, b: StaticSource): boolean => {
    if (a === b) return false;
    const before = a.def.appliesTo(ctx, a.sourceId, self, chars);
    const probe = cloneChars(chars);
    if (!b.def.appliesTo(ctx, b.sourceId, self, probe)) return false;
    b.def.modify(probe, ctx, b.sourceId, self);
    const afterB = a.def.appliesTo(ctx, a.sourceId, self, probe);
    // Clause (b), first half — what it APPLIES TO.
    if (afterB !== before) return true;
    // Clause (b), second half — what it DOES to what it applies to. Only for an
    // effect that has SAID its behaviour reads a characteristic; see
    // `StaticDef.effectReads` for why a measurement cannot stand in for that.
    if (!before || !a.def.effectReads?.length) return false;
    return a.def.effectReads.some((what) => changed(what, chars, probe));
  };

  const out: StaticSource[] = [];
  const left = [...sources];
  while (left.length > 0) {
    // ⚠️ TIMESTAMP ORDER IS THE SCAN ORDER, so it remains the tie-break between
    // two effects that depend on nothing — which is CR 613.8's default and
    // D129's fix, kept intact.
    let pick = left.findIndex((a) => !left.some((b) => b !== a && dependsOn(a, b)));
    // ⚠️ CR 613.8b — A DEPENDENCY LOOP IS IGNORED. Every remaining effect
    // depends on another, so the rule stops applying and timestamp order
    // resumes. Taking the first is also what makes this terminate.
    if (pick < 0) pick = 0;
    out.push(left[pick] as StaticSource);
    left.splice(pick, 1);
  }
  return out;
}

/**
 * The permanents on the battlefield that carry a static in this layer, in
 * BATTLEFIELD ORDER.
 *
 * ⚠️ **THE ORDER IS CR 613.7c AND IS LOAD-BEARING.** `state.zones.battlefield`
 * is arrival order (`addToZone` appends, and a permanent that re-enters goes to
 * the back), which is the timestamp order the layer system applies effects in —
 * `Levitation` against `Gravity Sphere` is decided by nothing else. The outer
 * loop must stay the BATTLEFIELD and the inner one the defs; nesting them the
 * other way applies every source of the first-registered script before any
 * source of the second, and the registry is not a timestamp. That was a real
 * bug (D129), so the index preserves the order rather than grouping by def.
 */
function staticSourcesFor(
  state: GameState,
  scripts: ScriptRegistry,
  cache: DeriveCache | undefined,
  layer: Parameters<ScriptRegistry['staticsFor']>[0],
): readonly StaticSource[] {
  const hit = cache?.staticSources.get(layer);
  if (hit) return hit;

  const defs = scripts.staticsFor(layer);
  const out: StaticSource[] = [];
  for (const sourceId of state.zones.battlefield) {
    const source = state.cards[sourceId];
    if (!source) continue;
    // D309 - a face-down source grants nothing (CR 708.2).
    if (source.faceDown) continue;
    for (const { script, def } of defs) {
      if (source.oracleId !== script.oracleId) continue;
      if (!def.activeZones.includes(source.zone.kind)) continue;
      out.push({ sourceId, def });
    }
  }
  cache?.staticSources.set(layer, out);
  return out;
}

/**
 * A read-only context for a static ability.
 *
 * ⚠️ `derive` inside it deliberately does NOT pass a cache: a static that
 * derived another object while that object's own derive was in flight would
 * poison the cache with a half-computed value. Statics are rare and shallow;
 * correctness wins.
 */
export function makeScriptCtx(state: GameState, oracle: OracleDb, scripts: ScriptRegistry): ScriptCtx {
  // Advancing allocators, one pair per ctx (D164) — statics never emit, but
  // every ScriptCtx keeps one contract: repeated calls hand out DISTINCT ids.
  let instAlloc = state.counters.instance;
  let stackAlloc = state.counters.stack;
  return {
    state,
    oracle,
    derive: (id) => derive(state, oracle, scripts, id),
    options: state.options,
    ids: {
      nextInstance: () => `c${++instAlloc}`,
      nextStack: () => `s${++stackAlloc}`,
    },
    query: {
      permanentsOf: (player) => state.zones.battlefield.filter((id) => state.cards[id]?.controller === player),
      controllerOf: (id) => state.cards[id]?.controller ?? null,
      isOnBattlefield: (id) => state.cards[id]?.zone.kind === 'battlefield',
    },
    random: {
      below: () => 0,
      shuffled: (xs) => xs,
    },
  };
}

function finish(
  chars: MutableCharacteristics,
  manaValue: number,
  producesMana: DerivedCharacteristics['producesMana'],
): DerivedCharacteristics {
  const types = chars.typeLine.types;
  const isCreature = types.includes('Creature');
  // ⚠️ A creature whose printed P/T is `*` (Tarmogoyf, Nightveil Specter) has no
  // parseable base, and layer 7a would set it — except that layer needs a card
  // script, and v1 ships none. It is therefore 0/0, and the SBA bins it on the
  // next pass. That is the honest Tier-2 answer: it is visibly wrong on screen
  // and in the log, so a player knows to use a Tier-3 override. Guessing 1/1
  // would put a number nobody can trace on the board.
  const power = isCreature ? (chars.power ?? 0) : chars.power;
  const toughness = isCreature ? (chars.toughness ?? 0) : chars.toughness;
  // ⚠️ **ONE PLACE, SO NOTHING CAN BE FORGOTTEN.** "Loses all abilities" is not
  // "loses its keywords": every ability-shaped field on a derived object has to
  // go, and each is separately load-bearing — `protection` and `landwalk` are
  // read by `canBlock`, `toxicAmount` by combat damage, `producesMana` by the
  // payment solver. Clearing only `keywords` would leave a Humility'd Akroma
  // still unblockable by red and a Humility'd Signet still tapping for mana.
  const gone = !chars.hasAbilities;
  const produces = gone ? [] : producesMana;
  return {
    name: chars.name,
    typeLine: chars.typeLine,
    colors: chars.colors,
    power,
    toughness,
    loyalty: chars.loyalty,
    defense: chars.defense,
    keywords: gone ? new Set<Keyword>() : chars.keywords,
    hasAbilities: !gone,
    protection: gone ? NO_PROTECTION : chars.protection,
    landwalk: gone ? [] : chars.landwalk,
    toxicAmount: gone ? 0 : chars.toxicAmount,
    isCreature,
    isLand: types.includes('Land'),
    isPermanent:
      types.includes('Artifact') ||
      types.includes('Battle') ||
      types.includes('Creature') ||
      types.includes('Enchantment') ||
      types.includes('Land') ||
      types.includes('Planeswalker') ||
      types.includes('Spacecraft'),
    isLegendary: chars.typeLine.supertypes.includes('Legendary'),
    manaValue,
    producesMana: produces,
  };
}

/** Does this creature have lethal damage marked on it? CR 704.5g. */
export function hasLethalDamage(d: DerivedCharacteristics, inst: CardInstance): boolean {
  if (!d.isCreature) return false;
  if (d.toughness === null) return false;
  if (inst.damage <= 0) return false;
  if (inst.deathtouchDamage) return true;
  return inst.damage >= d.toughness;
}

/**
 * Did applying an effect change one of the characteristics another effect says
 * it reads? CR 613.8a clause (b), second half.
 *
 * ⚠️ Compared by VALUE, not by reference: `cloneChars` copies the mutable
 * members, so a probe that changed nothing must compare equal or every declared
 * reader would depend on everything.
 */
function changed(
  what: 'keywords' | 'pt' | 'types' | 'colors',
  before: MutableCharacteristics,
  after: MutableCharacteristics,
): boolean {
  switch (what) {
    case 'keywords':
      return (
        before.keywords.size !== after.keywords.size ||
        [...before.keywords].some((k) => !after.keywords.has(k))
      );
    case 'pt':
      return before.power !== after.power || before.toughness !== after.toughness;
    case 'types':
      return before.typeLine.raw !== after.typeLine.raw;
    case 'colors':
      return before.colors.join(',') !== after.colors.join(',');
  }
}
