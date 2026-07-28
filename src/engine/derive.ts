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
import type { MutableCharacteristics, ScriptCtx } from './scripts/api';
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

export interface DeriveCache {
  eventCount: number;
  map: Map<InstanceId, DerivedCharacteristics>;
}

export function makeDeriveCache(state: GameState): DeriveCache {
  return { eventCount: state.eventCount, map: new Map() };
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
  const result = computeDerived(state, oracle, scripts, id);
  cache?.map.set(id, result);
  return result;
}

function computeDerived(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  id: InstanceId,
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
      protection: NO_PROTECTION,
      landwalk: [],
      toxicAmount: 0,
    }, 0, []);
  }

  const chars = layerOne(inst, oracle);

  // Layer 4 — type-changing. Only the Tier-3 manual override in v1.
  if (inst.typeOverride !== null) chars.typeLine = parseTypeLine(inst.typeOverride);

  // Layer 6 — ability adding/removing. Card scripts only; none in v1.
  applyStatics(state, oracle, scripts, inst, chars, 'ability');
  applyStatics(state, oracle, scripts, inst, chars, 'type');
  applyStatics(state, oracle, scripts, inst, chars, 'color');

  // Layer 7a — characteristic-defining P/T (`*`-power cards). A script sets it;
  // without one, `basePower` was already null and the card is 0/0. That is the
  // honest Tier-2 answer, and the SBA will bin it — which is visible, unlike a
  // silent guess of 1/1.
  applyStatics(state, oracle, scripts, inst, chars, 'cda');

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
  applyStatics(state, oracle, scripts, inst, chars, 'ptSet');

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
  applyStatics(state, oracle, scripts, inst, chars, 'ptModify');

  // Layer 7d(ours) — counters. CR puts +1/+1 counters in 7d proper.
  const plus = inst.counters['+1/+1'] ?? 0;
  const minus = inst.counters['-1/-1'] ?? 0;
  if (chars.power !== null) chars.power += plus - minus;
  if (chars.toughness !== null) chars.toughness += plus - minus;

  applyStatics(state, oracle, scripts, inst, chars, 'ptSwitch');

  const card = inst.faceDown ? undefined : oracle.byPrinting(inst.printingId);
  const manaValue = card?.manaValue ?? 0;
  const produces = inst.faceDown ? [] : (card ? faceOf(card, inst.faceIndex).producesMana : []);
  return finish(chars, manaValue, produces);
}

function layerOne(inst: CardInstance, oracle: OracleDb): MutableCharacteristics {
  // CR 708.2: a face-down permanent is a 2/2 creature with no name, no mana
  // cost and no abilities — a genuinely different object, not a hidden one.
  if (inst.faceDown && inst.zone.kind === 'battlefield') {
    return {
      name: '',
      typeLine: FACE_DOWN_TYPE,
      colors: [],
      power: 2,
      toughness: 2,
      loyalty: null,
      defense: null,
      keywords: new Set<Keyword>(),
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
      protection: NO_PROTECTION,
      landwalk: [],
      toxicAmount: 0,
    };
  }
  const face = faceOf(card, inst.faceIndex);
  return {
    name: face.name,
    typeLine: face.typeLine,
    colors: [...face.colors] as ColorLetter[],
    power: face.basePower,
    toughness: face.baseToughness,
    loyalty: face.baseLoyalty,
    defense: face.baseDefense,
    keywords: new Set<Keyword>(face.keywords),
    protection: face.protection,
    landwalk: [...face.landwalk],
    toxicAmount: face.toxicAmount,
  };
}

/**
 * Run every registered static ability of one layer against this object.
 *
 * With `EMPTY_REGISTRY` this is one `Map.get` returning a shared empty array and
 * a loop that does not run — which is the point of the design. Nothing here
 * asks whether the card is scripted.
 */
function applyStatics(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  inst: CardInstance,
  chars: MutableCharacteristics,
  layer: Parameters<ScriptRegistry['staticsFor']>[0],
): void {
  const defs = scripts.staticsFor(layer);
  if (defs.length === 0) return;
  const ctx = makeScriptCtx(state, oracle, scripts);
  for (const { script, def } of defs) {
    for (const sourceId of state.zones.battlefield) {
      const source = state.cards[sourceId];
      if (!source || source.oracleId !== script.oracleId) continue;
      if (!def.activeZones.includes(source.zone.kind)) continue;
      if (!def.appliesTo(ctx, sourceId, inst.id)) continue;
      def.modify(chars, ctx, sourceId, inst.id);
    }
  }
}

/**
 * A read-only context for a static ability.
 *
 * ⚠️ `derive` inside it deliberately does NOT pass a cache: a static that
 * derived another object while that object's own derive was in flight would
 * poison the cache with a half-computed value. Statics are rare and shallow;
 * correctness wins.
 */
function makeScriptCtx(state: GameState, oracle: OracleDb, scripts: ScriptRegistry): ScriptCtx {
  return {
    state,
    oracle,
    derive: (id) => derive(state, oracle, scripts, id),
    options: state.options,
    ids: {
      nextInstance: () => `c${state.counters.instance + 1}`,
      nextStack: () => `s${state.counters.stack + 1}`,
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
  return {
    name: chars.name,
    typeLine: chars.typeLine,
    colors: chars.colors,
    power,
    toughness,
    loyalty: chars.loyalty,
    defense: chars.defense,
    keywords: chars.keywords,
    protection: chars.protection,
    landwalk: chars.landwalk,
    toxicAmount: chars.toxicAmount,
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
    producesMana,
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
