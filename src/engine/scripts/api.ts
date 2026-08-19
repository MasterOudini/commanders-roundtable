// The per-card script surface. **v1 ships zero scripts.**
//
// ⚠️ The property this file exists to guarantee: a script-less card is
// LITERALLY ZERO REGISTRATIONS. `registry.get(oracleId)` returns undefined,
// `derive()` runs L1/L7b/L7d only, the trigger bus iterates an empty candidate
// list, and `legalActions` offers only the intrinsic actions. Nothing in the
// engine branches on "is this card scripted" — the ABSENCE of registrations is
// the answer. That is what makes adding a script later a pure addition rather
// than a rewrite, and it is why the surface is defined now, while it costs
// nothing, instead of being retrofitted around whatever the first script needs.
//
// ⚠️ Scripts RETURN EVENTS. They are never handed a mutation API. A script is a
// pure function of (state, self, object) whose output is fully reproducible
// from the log, and `ctx.random` is backed by a scratch RNG the loop seeded
// from `state.rng` — so even a coin-flip card replays bit-exactly.

import type { ColorLetter } from '../../data/cardTypes';
import type { EventBody, EventKind } from '../types/events';
import type { AbilityRef, InstanceId, OracleId, PlayerId, ZoneKind } from '../types/ids';
import type { DerivedCharacteristics, Keyword, OracleDb, ParsedTypeLine, Protection, TargetSpec } from '../types/oracle';
import type { GameOptions, GameState, StackObject } from '../types/state';

/** The mutable form a static ability edits. Copied out of `derive()`'s workspace. */
export interface MutableCharacteristics {
  name: string;
  typeLine: ParsedTypeLine;
  colors: ColorLetter[];
  power: number | null;
  toughness: number | null;
  loyalty: number | null;
  defense: number | null;
  keywords: Set<Keyword>;
  /**
   * **CR 613 layer 6 — this object has LOST ALL ITS ABILITIES.**
   *
   * ⚠️ **THE ONE THING `MutableCharacteristics` COULD NOT SAY**, named as
   * unrepresentable by D129, D147, D148, D149 and D150 in turn. Every other
   * ability in this engine is a keyword and lives in `keywords`; a triggered,
   * static, activated or mana ability lives in the SCRIPT REGISTRY, keyed by
   * `oracleId` — so "lose all abilities" had nowhere to be written. It is a
   * FLAG rather than a list because that is what the rule is: not "remove these
   * abilities" but "have none".
   *
   * ⚠️ It is read in five places, and missing any one of them would leave a
   * `Humility`d creature with half its abilities: `finish()` (keywords, mana,
   * protection, landwalk, toxic), the trigger bus, the static index, the
   * replacement funnel, and `legalActions`' activated-ability offer.
   */
  hasAbilities: boolean;
  protection: Protection;
  landwalk: string[];
  /** `Toxic N`. Layer 6 can grant the keyword; this is the amount that came with it. */
  toxicAmount: number;
}

export type DeriveFn = (id: InstanceId) => DerivedCharacteristics;

export interface EngineQueries {
  /** Battlefield permanents controlled by a player, in board order. */
  permanentsOf(player: PlayerId): readonly InstanceId[];
  controllerOf(id: InstanceId): PlayerId | null;
  isOnBattlefield(id: InstanceId): boolean;
}

export interface ScriptCtx {
  readonly state: GameState;
  readonly oracle: OracleDb;
  readonly derive: DeriveFn;
  readonly options: GameOptions;
  /** Deterministic: seeded from state counters, never from a global. */
  readonly ids: { nextInstance(): InstanceId; nextStack(): string };
  readonly query: EngineQueries;
  /** The loop threads the resulting rngAfter onto the emitted event. */
  readonly random: { below(n: number): number; shuffled<T>(xs: readonly T[]): readonly T[] };
}

export interface TriggerDef {
  readonly abilityId: string;
  readonly text: string;
  /** Pre-indexed by the registry, so the bus is O(#candidates), not O(#permanents). */
  readonly event: EventKind;
  readonly activeZones: readonly ZoneKind[];
  readonly optional: boolean;
  /**
   * One spec per printed target clause, in printed order. Omit for a trigger
   * that targets nothing — which is most of them, and the reason this is
   * optional rather than an empty array everywhere.
   *
   * ⚠️ **CHOSEN AS THE ABILITY GOES ON THE STACK (CR 603.3d), NOT AT
   * RESOLUTION.** `drainTriggers` puts the object on the stack and asks
   * immediately; the answer lands on `StackObject.targets`, which `resolve`
   * already receives. That is why this needed no change to `resolve`.
   *
   * ⚠️ **AND CHECKED AGAIN ON RESOLUTION (CR 608.2b).** A trigger whose every
   * target has become illegal does not resolve at all — the board moves between
   * the two moments, which is the whole reason targeting is a two-step rule.
   */
  readonly targets?: readonly TargetSpec[];
  /**
   * PER-ITEM FAN-OUT (D190) — the granularity family's unlock. The bus fires
   * a def once per matching EVENT, and several event kinds BATCH their items
   * (`CombatDamageDealt` batches every creature's damage, `PermanentsTapped`
   * every tap, `AttackersDeclared` every attacker, `DrewCards` every card) —
   * so per-item wording ("whenever a creature you control deals combat
   * damage to a player", "whenever you draw a card") UNDER-FIRED and was
   * refused outright (Aya's D163 class, met again in D172, D185, D186).
   *
   * When present, and after `matches` accepts the event, the bus creates ONE
   * `PendingTrigger` PER returned instance id, each carrying that id as
   * `item` — which rides the stack object into `resolve` (`obj.item`). An
   * empty return fires nothing. The ids are returned in the EVENT's own item
   * order, so the trigger sequence is deterministic and replays.
   *
   * ⚠️ Omit it for self-only filters, per-creature entries and printed "one
   * or more" wordings — each of those matches its batch by construction
   * (D185's list), and fanning them out would OVER-fire instead.
   */
  readonly perItem?: (ctx: ScriptCtx, self: InstanceId, ev: EventBody) => readonly InstanceId[];
  /**
   * CR 603.10a — this trigger LOOKS BACK IN TIME.
   *
   * ⚠️ A "dies" or "leaves the battlefield" trigger is the case, and without
   * this it cannot be written correctly at all: by the time the bus runs, the
   * card is in a graveyard, so `activeZones: ['battlefield']` rejects its own
   * source and `matches` is handed a board the creature has already left. Both
   * questions are asked of the state BEFORE the event when this is set.
   */
  readonly looksBack?: boolean;
  matches(ctx: ScriptCtx, self: InstanceId, ev: EventBody): boolean;
  label(ctx: ScriptCtx, self: InstanceId, ev: EventBody): string;
  resolve(ctx: ScriptCtx, self: InstanceId, obj: StackObject): readonly EventBody[];
}

/**
 * A continuous COMBAT RESTRICTION — CR 508.1c / 509.1b.
 *
 * ⚠️ **RESTRICTIONS ONLY, and the split is measured.** Over the Commander-legal
 * pool: 1,138 lines read "can't be blocked", 393 "can't attack", 320 "can't
 * block" — against 123 "attacks each combat if able" and 39 "must be blocked if
 * able". Restrictions outnumber requirements 11:1, and they are a genuinely
 * different rule: a restriction is a question about ONE creature that
 * `canAttack`/`canBlock` can answer, where a requirement (CR 508.1d) is a
 * property of the whole DECLARATION — "the maximum possible number of
 * requirements is obeyed" cannot be checked one creature at a time. Building the
 * requirement half here would be half-executing it (D90).
 *
 * ⚠️ Deliberately NOT a `StaticDef` layer. CR 613 layers settle
 * CHARACTERISTICS, and "can't block" is not a characteristic — it is a rule
 * about an action. Filing it under layer 6 is what made D129 report 227 cards
 * as layer-6 work when the engine had no seam for them at all.
 */
export interface CombatDef {
  readonly abilityId: string;
  readonly text: string;
  readonly activeZones: readonly ZoneKind[];
  /**
   * `false` to stop `candidate` attacking. Omit if this ability says nothing
   * about attacking.
   *
   * ⚠️ It is asked about EVERY creature, not only this permanent's own — an
   * anthem-shaped restriction ("creatures your opponents control can't attack
   * you") is the common case, and a def that only ever answered about `self`
   * could not express one.
   */
  canAttack?(ctx: ScriptCtx, self: InstanceId, candidate: InstanceId): boolean;
  /** `false` to stop `blocker` blocking `attacker`. */
  canBlock?(ctx: ScriptCtx, self: InstanceId, blocker: InstanceId, attacker: InstanceId): boolean;
}

export interface StaticDef {
  readonly abilityId: string;
  readonly text: string;
  readonly layer: 'type' | 'color' | 'ability' | 'cda' | 'ptSet' | 'ptModify' | 'ptSwitch';
  readonly activeZones: readonly ZoneKind[];
  /**
   * @param chars the CANDIDATE's characteristics as the layers have built them
   *   so far — layer 1 and everything below this def's own layer, and nothing
   *   above it. That is the object CR 613 says this question is about.
   *
   * ⚠️ **NEVER CALL `ctx.derive(candidate)` HERE.** `appliesTo` runs INSIDE that
   * object's own `derive`, so asking it to derive itself is unbounded
   * recursion — measured as `RangeError: Maximum call stack size exceeded` on
   * the first real layer-6 script written against the old three-argument
   * signature, whose only sin was asking "is this a creature". `chars` is that
   * answer, and it is a better one: `chars.typeLine` has layer 4 applied, which
   * a printed type line does not. `ctx.derive` on ANOTHER object is still fine
   * and is what "as long as you control a Forest" needs.
   */
  appliesTo(
    ctx: ScriptCtx,
    self: InstanceId,
    candidate: InstanceId,
    chars: Readonly<MutableCharacteristics>,
  ): boolean;
  modify(chars: MutableCharacteristics, ctx: ScriptCtx, self: InstanceId, candidate: InstanceId): void;
  /**
   * Characteristics this effect's OWN BEHAVIOUR reads — CR 613.8a clause (b),
   * second half: "what it does to any of the things it applies to".
   *
   * ⚠️ **A DECLARATION, NOT A MEASUREMENT, AND THAT DISTINCTION IS THE WHOLE
   * RULE.** The naive reading — "applying B changes A's output, therefore A
   * depends on B" — is WRONG, and it was measured wrong rather than reasoned
   * wrong: implemented that way, `Gravity Sphere` ("all creatures lose flying")
   * came out depending on `Levitation` ("creatures you control have flying"),
   * because without Levitation there is no flying to remove and with it there
   * is. That made Levitation always apply first and the creature never fly —
   * the wrong answer when Levitation entered LAST, and it broke D129's
   * timestamp pair, which is correct MTG.
   *
   * ⚠️ **ACTING ON A DIFFERENT STARTING STATE IS ORDERING, NOT DEPENDENCY.**
   * Clause (b) is about the effect's own SPECIFICATION changing — an effect
   * that says "gains all abilities of that creature" genuinely does something
   * different when that creature's abilities change. An effect that says "loses
   * flying" always does the same thing; only the board it lands on differs.
   * Nothing but the def itself can tell those apart, so the def says.
   *
   * ⚠️ Omit it — as every script in this project does — and the effect is
   * ordered by `appliesTo` and timestamp alone, which is what CR 613.7 wants.
   */
  readonly effectReads?: readonly ('keywords' | 'pt' | 'types' | 'colors')[];
}

export interface ReplacementDef {
  readonly abilityId: string;
  readonly text: string;
  readonly activeZones: readonly ZoneKind[];
  applies(ctx: ScriptCtx, self: InstanceId, ev: EventBody): boolean;
  /** `[]` prevents the event entirely. Must not re-trigger itself. */
  replace(ctx: ScriptCtx, self: InstanceId, ev: EventBody): readonly EventBody[];
}

/**
 * The EFFECT of a printed activated ability the engine already charges.
 *
 * ⚠️ EVERY FIELD HERE IS CONSULTED, and the interface is deliberately this
 * small (D159). The engine's own machinery owns everything up to resolution —
 * `activatedParse` reads the cost, `legal.ts` offers it, `handlers.ts` charges
 * it and puts the object on the stack — so a def owes exactly three things:
 * which ability it is (`ref`, the `${oracleId}#a${index}` the handler writes),
 * the printed line it claims (`text`, the accounting's key), and the events.
 * The first cut of this interface carried `activeZones`, `isManaAbility` and
 * `canActivate` too, and NOTHING consulted them for three milestones — D158's
 * dead-seam disease, in the seam's own type. Fields return WITH their consult
 * sites, never ahead of them.
 *
 * ⚠️ `resolve` may run with its source in a GRAVEYARD — a self-sacrifice cost
 * (Hedron Archive) pays the source away at activation — so read
 * `obj.controller`, never the board position of `self`.
 */
export interface ActivatedDef {
  readonly ref: AbilityRef;
  readonly text: string;
  resolve(ctx: ScriptCtx, self: InstanceId, obj: StackObject): readonly EventBody[];
}

/**
 * The whole-spell resolution of an INSTANT or SORCERY — the seam D160 named
 * as the largest structural gap: `select.cjs` hands out spells and, until
 * this, `CardScript` had nowhere to put one.
 *
 * Consulted by `resolveTop` for a resolving spell whose oracleId carries a
 * def, BEFORE `effectParse`'s vocabulary — exactly one of the two runs, and
 * the def outranks, because a def claims the WHOLE card (the accounting
 * refuses partial claims) and running the vocabulary after it would double
 * every clause the parser also understood. Unscripted spells keep resolving
 * through the vocabulary unchanged.
 *
 * What the def INHERITS from the seam point (loop.ts): the spell is still ON
 * the stack while it resolves (CR 608.2 — its own text can point at the
 * board it is about to leave, and a Char has a source for its damage), and
 * fizzle has already been decided (CR 608.2b, `targetsStillLegal`), so
 * `resolve` runs only with the declared targets still legal.
 *
 * `text` is the cast face's FULL printed oracle text — `lineClaims` splits
 * it per line, so a spell def claims every line of its card or the coverage
 * accounting refuses it (D90: never half-execute). `self` is the card on the
 * stack (`obj.card`), and the controller is `obj.controller`, never the
 * card's owner (Kess casts from a graveyard).
 *
 * ⚠️ No randomness until `ctx.random` is wired (D158's standing item): the
 * vocabulary path threads `rngAfter` and this seam does not yet, so a def
 * that consumed randomness would replay to a different board than it played.
 */
export interface SpellDef {
  readonly text: string;
  resolve(ctx: ScriptCtx, self: InstanceId, obj: StackObject): readonly EventBody[];
}

export interface CardScript {
  readonly oracleId: OracleId;
  readonly name: string;
  readonly triggers?: readonly TriggerDef[];
  readonly statics?: readonly StaticDef[];
  readonly replacements?: readonly ReplacementDef[];
  readonly activated?: readonly ActivatedDef[];
  /** Continuous combat RESTRICTIONS. See `CombatDef`. */
  readonly combat?: readonly CombatDef[];
  /** Whole-spell resolution for an instant or sorcery. See `SpellDef`. */
  readonly spell?: SpellDef;
}
