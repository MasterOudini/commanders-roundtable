/**
 * D367 - THE QUOTED GRANT, part 2: the runtime carrier.
 *
 * A permanent whose line reads `<scope> has "<activated ability>"` installs that
 * ability on every permanent in the scope. The engine already had every piece but
 * one: an `ActivatedDef` the resolution consults by ref (D159), a layer-6
 * `StaticDef` that reaches a candidate's characteristics (D129), the cost machinery
 * an activation pays through (D168/D286/D329/D352/D363), and the vocabulary a
 * payload resolves through (D344). What it lacked was a place on the derived
 * object for an ability the object does not PRINT - so `legal.ts` read
 * activations off `face.activated` alone, and nothing could offer a granted one.
 *
 * `MutableCharacteristics.grantedActivated` is that place. A grant module is
 * two ordinary defs on the PROVIDER's script:
 *
 *   - a `StaticDef` at layer `'ability'` whose `appliesTo` is the scope (the
 *     attached creature, every Sliver, ...) and whose `modify` pushes
 *     `{ provider: self, ref, ability }` onto the candidate;
 *   - an `ActivatedDef` with that `ref` (`<providerOracleId>#g<n>`), carrying the
 *     parsed ability as `granted` and resolving the quoted body's effect.
 *
 * The RECIPIENT is the ability's source (CR 113.7a): it is offered the ability
 * (`legal.ts`, beside its own printed ones), it pays the cost (its own {T}, its
 * own sacrifice), it is `obj.source` at resolution - so "this creature" and
 * "you" in the quoted body resolve on the recipient and its controller, which is
 * exactly what the printed card means.
 *
 * ⚠️ THE QUOTED BODY IS PARSED AS ANY PRINTED ABILITY IS, ONCE, AT MODULE LOAD,
 * and refused by name when the engine cannot charge it (D90: a cost the engine
 * cannot charge is a cost it must not claim). `vocabularyEffects` beside it
 * refuses a payload the vocabulary does not read whole - including a MANA ability
 * ("{T}: Add {G}." parses as an activated ability whose effect the vocabulary
 * has no rule for), which is right: a granted mana ability must take the
 * engine's immediate mana path (CR 605), a seam this decision does not build.
 *
 * ⚠️ `producesMana` is `[]` on purpose: the face-level parse asks
 * `parseManaProduction` which lines are mana abilities, and a quoted body is
 * not a face. The consequence is stated above - a quoted mana ability reads as
 * non-mana and is refused at the vocabulary, never half-run.
 */
import { parseActivatedAbilities } from '../../data/activatedParse';
import { parseManaCost, parseManaProduction } from '../../data/oracleParse';
import type { CardFace } from '../../data/cardTypes';
import type { MutableCharacteristics } from './api';
import type { AbilityRef } from '../types/ids';
import type { ActivatedAbility, ManaProduction, ParsedTypeLine } from '../types/oracle';

/** A grant, parsed: the ref the def carries and the ability the recipient is offered. */
export interface GrantedActivatedDef {
  readonly ref: AbilityRef;
  readonly ability: ActivatedAbility;
  /** The quoted body, verbatim - what the def's `resolve` hands the vocabulary. */
  readonly quoted: string;
}

/**
 * Parse one quoted activated ability for a grant, or throw naming the card and
 * the reason. `ref` must be the grant form (`<oracleId>#g<n>`) - `legal.ts` and
 * the handler tell a granted ref from a printed one by that marker.
 */
export function grantedActivated(quoted: string, ref: AbilityRef, name: string): GrantedActivatedDef {
  if (!/#g\d+$/.test(ref)) {
    throw new Error(`${name}: a granted ability's ref must read "<oracleId>#g<n>", not "${ref}".`);
  }
  const parsed = parseActivatedAbilities({ oracleText: quoted, isPermanent: true, producesMana: [], parseCost: parseManaCost });
  if (parsed.length !== 1) {
    throw new Error(`${name}: the quoted ability "${quoted}" reads as ${parsed.length} activated abilities - a grant carries exactly one (D90).`);
  }
  const ability = parsed[0] as ActivatedAbility;
  if (!ability.payable) {
    throw new Error(`${name}: the quoted ability's cost "${ability.costText}" is not one the engine can charge (${ability.unpaidCosts.join(', ')}) - the grant must not claim it (D90).`);
  }
  if (ability.isLoyalty || ability.cycling !== undefined || ability.equip !== undefined || ability.crew !== undefined) {
    throw new Error(`${name}: the quoted ability "${quoted}" is a keyword the engine synthesizes, not a granted activation.`);
  }
  return { ref, ability, quoted };
}

/**
 * D368 - THE TRIGGERED HALF. A granted trigger needs no parsed copy of itself:
 * `legal.ts` had to be handed a COST to offer an activated ability, but the bus
 * reads the def straight off the PROVIDER's script by ref. So the carrier stores
 * `{ provider, ref }` alone, and this is the ref's shape guard.
 *
 * ⚠️ THE `gt` MARKER IS LOAD-BEARING, not decoration: `registryCore` indexes a
 * trigger def as GRANTED precisely when its `abilityId` starts with it, and that
 * index is the bus's gate. A granted trigger whose abilityId did not say so would
 * be indexed only under its provider's oracleId, where the recipient's walk can
 * never find it - it would simply never fire.
 */
export function grantedTriggerRef(ref: AbilityRef, name: string): AbilityRef {
  if (!/#gt\d+$/.test(ref)) {
    throw new Error(`${name}: a granted trigger's ref must read "<oracleId>#gt<n>", not "${ref}".`);
  }
  return ref;
}

/**
 * D372 - THE GRANTED MANA ABILITY. A quoted "{T}: Add {G}." is a MANA ability
 * (CR 605.1a), and a mana ability never uses the stack: it is offered, paid and
 * resolved in one accept by `tapForMana`, which reads the recipient`s DERIVED
 * `producesMana`. So the carrier is not a def at all - it is a production the
 * provider`s layer-6 static pushes onto the recipient`s characteristics, read by
 * the same ingest parser that reads a printed mana line, so a granted "one mana
 * of any color" and a printed one are the SAME production (D356`s rule for
 * protection, one parser over).
 *
 * Refused by name (D90): a line that is not exactly one mana ability, and a
 * CONDITIONAL one - a spend restriction, an unread cost piece, an amount the
 * engine cannot compute - which it would otherwise offer and then half-run.
 */
export function grantedMana(quoted: string, name: string): ManaProduction {
  const face = { name, oracleText: quoted } as unknown as CardFace;
  const typeLine: ParsedTypeLine = { supertypes: [], types: [], subtypes: [], raw: '' };
  const parsed = parseManaProduction(face, typeLine);
  if (parsed.length !== 1) {
    throw new Error(`${name}: the quoted line "${quoted}" reads as ${parsed.length} mana abilities - a grant carries exactly one (D90).`);
  }
  const prod = parsed[0] as ManaProduction;
  if (prod.conditional) {
    throw new Error(`${name}: the quoted mana ability "${quoted}" is conditional (a spend restriction, a cost the engine does not charge, or an amount it cannot compute) - the grant must not claim it (D90).`);
  }
  return prod;
}

/**
 * Install a granted production on a recipient, from a static`s `modify`. The
 * `abilityIndex` is the recipient`s NEXT index - after its printed productions
 * and any grant already installed - which is what `TapForMana` names and what
 * `manaSourcesOf` reads back off the same derivation.
 */
export function pushGrantedMana(chars: MutableCharacteristics, prod: ManaProduction): void {
  chars.producesMana.push({ ...prod, abilityIndex: chars.producesMana.length });
}
