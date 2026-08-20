// Can this be pointed at? — the ONE rule, and the two adapters that feed it.
//
// ⚠️ THE POINT OF THIS FILE IS THAT THE RULE IS WRITTEN ONCE. The host decides
// legality from `GameState` + `derive()`; the client lights the aim veil from a
// `PlayerView` + its printing pool, with no `GameState` anywhere. Both build the
// same flat `TargetCandidate` record and hand it to the same predicate, which
// cannot tell them apart. That is D53's shape — `suggestPayment` on the client,
// `validatePlan` on the host, one solver — applied to targeting. Two copies of
// "can this be targeted" would drift, and the drift would look like the host
// rejecting a target the UI had just lit up green.
//
// ⚠️ `TargetCandidate.zone` is its OWN token, deliberately not `ZoneKind`. There
// are two `ZoneKind`s in this codebase with different values — `'battlefield'`
// in `engine/types/ids.ts` and `'bf'` in `view/types.ts` — so a predicate typed
// against "ZoneKind" would compile against whichever one the importer happened to
// mean and silently disagree between host and guest.
//
// ⚠️ HEXPROOF AND SHROUD ARE ENFORCED HERE FOR THE FIRST TIME. Both have been in
// the Tier-2 table since M1 and were read by nothing — the same gap D68 found for
// ward, and found the same way. What is enforced is the PRINTED keyword only;
// a granted one needs a layer-6 continuous effect and `SHIPPED_REGISTRY` ships, so
// Lightning Greaves does nothing. `tier3.ts` says so on the card.

import type { ColorLetter } from '../data/cardTypes';
import type { InstanceId, PlayerId } from './types/ids';
import type { GameState, TargetChoice } from './types/state';
import type { OracleDb, Protection, TargetKind, TargetSpec } from './types/oracle';
import { derive, makeDeriveCache, type DeriveCache } from './derive';
import { faceOf } from './oracle';
import type { ScriptRegistry } from './scripts/registry';

export type CandidateZone = 'battlefield' | 'graveyard' | 'exile' | 'stack' | 'player';

/**
 * The normalised form of one thing a player could point at.
 *
 * Deliberately a flat record of facts rather than a `CardInstance`: that is what
 * lets the host and the client both produce it.
 */
export interface TargetCandidate {
  readonly choice: TargetChoice;
  readonly zone: CandidateZone;
  /** The player who controls it. For a player candidate, themselves. */
  readonly controller: PlayerId;
  /** What this object counts as. A creature land is both. */
  readonly kinds: readonly TargetKind[];
  /**
   * Its CARD TYPES — `Creature`, `Instant`, `Land` — as derived, not as printed.
   *
   * ⚠️ **`kinds` CANNOT ANSWER "is this a creature CARD".** In a graveyard every
   * object gets exactly one kind, `card`, whatever it is (see `kindsFromTypes`),
   * which is right for "target card in a graveyard" and useless for the 200+
   * cards that say "target CREATURE card". Before D138 that restriction was
   * listed in `unenforced` and checked by nothing, so `Raise Dead` — "Return
   * target creature card from your graveyard to your hand" — would happily take
   * a LAND. See D138.
   */
  readonly types: readonly string[];
  /**
   * The three numbers a clause can restrict on (D139): mana value, and derived
   * power/toughness. `null` where the object has none — a land has no power, and
   * a player has none of the three.
   *
   * ⚠️ **DERIVED, NOT PRINTED.** A creature under a +2/+2 effect really does have
   * power 4, and "target creature with power 4 or greater" really does admit it
   * — CR 613 settles characteristics before targeting legality is checked.
   * Reading the printed value instead would refuse a legal target, which is the
   * one direction this file may never be wrong in.
   */
  readonly manaValue: number | null;
  readonly power: number | null;
  readonly toughness: number | null;
  readonly colors: readonly ColorLetter[];
  readonly hexproof: boolean;
  readonly shroud: boolean;
  readonly protection: Protection;
}

/** The spell or ability doing the targeting. */
export interface TargetingSource {
  readonly controller: PlayerId;
  /** CR 702.16b needs the SOURCE's colours, not the target's. */
  readonly colors: readonly ColorLetter[];
}

/**
 * The CR restrictions the engine actually knows.
 *
 * ⚠️ Hexproof stops only spells and abilities OPPONENTS control (CR 702.11b) —
 * the printed reminder text says "can't be the target of spells or abilities your
 * opponents control". Reading it as "nobody" would stop a player pumping their
 * own hexproof creature, which is a rule players feel immediately.
 *
 * ⚠️ Shroud stops EVERYONE including the controller (CR 702.18b). The asymmetry
 * between these two is the whole reason they are separate keywords.
 */
export function untargetableByRule(src: TargetingSource, c: TargetCandidate): boolean {
  if (c.shroud) return true;
  if (c.hexproof && src.controller !== c.controller) return true;
  if (c.protection.fromEverything) return true;
  if (c.protection.colors.some((col) => src.colors.includes(col))) return true;
  // `protection.other` is verbatim and UNENFORCED — `tier3.ts` already says so.
  return false;
}

/** Does this candidate satisfy this clause? */
export function targetAllowed(
  spec: TargetSpec,
  src: TargetingSource,
  c: TargetCandidate,
): boolean {
  // ⚠️ Checked BEFORE the free-aim early-out. "The engine does not know what this
  // card can target" never means "the engine forgets that shroud exists".
  if (untargetableByRule(src, c)) return false;

  // Free aim: the parser could not read the clause, so anything the player
  // points at is accepted rather than narrowed on a guess.
  if (spec.kinds.length === 0) return true;

  if (!spec.kinds.some((k) => c.kinds.includes(k))) return false;
  if (spec.controller === 'you' && c.controller !== src.controller) return false;
  if (spec.controller === 'opponent' && c.controller === src.controller) return false;

  /**
   * ⚠️ **THE ZONE, WHICH THIS PREDICATE IGNORED UNTIL D138.** `TargetSpec.zones`
   * has existed since the targeting work and was read by NOTHING — the field's
   * own comment said "narrowed by `TargetSpec.zones`" about a narrowing that did
   * not happen. Everything in a graveyard OR exile answers to kind `card`, so
   * "target card in your graveyard" admitted exiled cards too.
   *
   * Empty means the clause named no zone, which is free aim over zones — the
   * same asymmetry the rest of this file follows: an unread restriction may
   * ALLOW an illegal choice, never BLOCK a legal one.
   */
  if (spec.zones.length > 0) {
    if (c.zone !== 'graveyard' && c.zone !== 'exile') return false;
    if (!spec.zones.includes(c.zone)) return false;
  }

  /**
   * ⚠️ **AND THE CARD TYPE, for the same reason.** "Target creature card" and
   * "target card" produced the identical spec, so `Raise Dead` could return a
   * land. ANY of the named types matches: "instant or sorcery card" is a
   * disjunction, and a card that is both still qualifies.
   */
  if (spec.cardTypes.length > 0 && !spec.cardTypes.some((t) => c.types.includes(t))) return false;

  /**
   * ⚠️ **THE NUMERIC RESTRICTION, AND IT WAS NOT EVEN DISCLAIMED** (D139).
   * "Destroy target creature with power 4 or greater" parsed to
   * `kinds:['creature'], confident:true, unenforced:[]` — the qualifier matched
   * no noun entry, so it was never recorded anywhere at all. `Smite the
   * Monstrous` would destroy a 1/1, and `tier3.ts` said nothing about it,
   * because there was nothing to say. That is a step worse than the zone and
   * type holes D138 closed: those at least left a trace.
   *
   * ⚠️ **A MISSING NUMBER REFUSES.** A land has no power and a player has no
   * mana value, so `null` here means the candidate cannot satisfy a clause about
   * that attribute — not that the clause is waived. This is the one place in
   * this file where absence narrows rather than widens, and it is right because
   * the SPEC is known: the parser read the restriction, so the asymmetry that
   * protects unread clauses does not apply.
   */
  if (spec.numeric) {
    const actual =
      spec.numeric.attr === 'power' ? c.power : spec.numeric.attr === 'toughness' ? c.toughness : c.manaValue;
    if (actual === null) return false;
    if (spec.numeric.cmp === 'atMost' && actual > spec.numeric.value) return false;
    if (spec.numeric.cmp === 'atLeast' && actual < spec.numeric.value) return false;
  }

  return true;
}

export function legalTargetsFor(
  spec: TargetSpec,
  src: TargetingSource,
  candidates: readonly TargetCandidate[],
): TargetChoice[] {
  return candidates.filter((c) => targetAllowed(spec, src, c)).map((c) => c.choice);
}

/**
 * The smallest legal declaration for a set of clauses, or `null` when the board
 * cannot satisfy them.
 *
 * ⚠️ **ONE COPY, TWO QUESTIONS.** The fuzz/test driver needs the VALUE ("what do
 * I answer this prompt with"); the engine needs only whether it is null ("may
 * this trigger go on the stack at all", CR 603.3d). Those were about to be two
 * greedy fills in two files that could disagree — the same split D53 closed for
 * candidate building, and D102 for the driver's answers.
 *
 * ⚠️ Fills each clause from its OWN legal set and never lets one object answer
 * two clauses, because `validateTargets` runs a one-for-one matching and would
 * reject "the first N legal choices" whenever two picks answered the same clause
 * (D102's `planTargets`, same reasoning).
 */
export function minimumLegalTargets(
  specs: readonly TargetSpec[],
  src: TargetingSource,
  candidates: readonly TargetCandidate[],
): TargetChoice[] | null {
  const picked: TargetChoice[] = [];
  for (const spec of specs) {
    for (let i = 0; i < spec.min; i++) {
      const next = legalTargetsFor(spec, src, candidates).find(
        (c) => !picked.some((p) => p.kind === c.kind && p.id === c.id),
      );
      if (!next) return null;
      picked.push(next);
    }
  }
  return picked;
}

// ── assignment ───────────────────────────────────────────────────────────────

function sameChoice(a: TargetChoice, b: TargetChoice): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/**
 * Assign each chosen target to the clause it answers.
 *
 * ⚠️ `TargetChoice[]` stays a FLAT list rather than gaining a clause index,
 * because it lives on `StackObject.targets`, crosses the wire and reaches
 * `StackItemView` — changing its shape would ripple through four layers to save
 * this function. Brute force is free at the real sizes (≤ 4 clauses, ≤ 8 picks),
 * and per-line splitting already makes one clause the overwhelmingly common case.
 */
export function assignTargets(
  specs: readonly TargetSpec[],
  src: TargetingSource,
  choices: readonly TargetChoice[],
  candidateOf: (c: TargetChoice) => TargetCandidate | null,
): readonly number[] | null {
  const assignment: number[] = new Array<number>(choices.length).fill(-1);
  const used: number[] = specs.map(() => 0);

  const place = (i: number): boolean => {
    if (i === choices.length) return specs.every((s, si) => (used[si] ?? 0) >= s.min);
    const choice = choices[i];
    if (!choice) return false;
    const cand = candidateOf(choice);
    if (!cand) return false;
    for (const [si, spec] of specs.entries()) {
      if ((used[si] ?? 0) >= spec.max) continue;
      if (!targetAllowed(spec, src, cand)) continue;
      assignment[i] = si;
      used[si] = (used[si] ?? 0) + 1;
      if (place(i + 1)) return true;
      used[si] = (used[si] ?? 0) - 1;
      assignment[i] = -1;
    }
    return false;
  };

  return place(0) ? assignment : null;
}

export type TargetVerdict = { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Validate a whole declaration. Messages are written from the player's side and
 * say what to do, which is this app's rule for every error string.
 */
export function validateTargets(
  specs: readonly TargetSpec[],
  src: TargetingSource,
  label: string,
  choices: readonly TargetChoice[],
  candidates: readonly TargetCandidate[],
): TargetVerdict {
  // A face with no clauses accepts anything and demands nothing. This is the
  // escape hatch for the categories the parser deliberately declines — modal
  // spells, triggered-ability clauses — so there is no card whose targets a
  // player is physically unable to declare.
  if (specs.length === 0) return { ok: true };

  const byChoice = new Map<string, TargetCandidate>();
  for (const c of candidates) byChoice.set(`${c.choice.kind}:${c.choice.id}`, c);
  const candidateOf = (c: TargetChoice): TargetCandidate | null =>
    byChoice.get(`${c.kind}:${c.id}`) ?? null;

  for (const [i, choice] of choices.entries()) {
    if (choices.findIndex((o) => sameChoice(o, choice)) !== i) {
      return { ok: false, message: `${label} can't target the same thing twice.` };
    }
    const cand = candidateOf(choice);
    if (!cand) {
      return { ok: false, message: `That is no longer there — choose a target for ${label} again.` };
    }
    if (untargetableByRule(src, cand)) {
      return { ok: false, message: untargetableMessage(src, cand, label) };
    }
  }

  const min = specs.reduce((n, s) => n + s.min, 0);
  const max = specs.reduce((n, s) => n + s.max, 0);
  if (choices.length < min) {
    return { ok: false, message: `${label} needs ${min === 1 ? 'a target' : `${min} targets`}.` };
  }
  if (choices.length > max) {
    return { ok: false, message: `${label} takes at most ${max === 1 ? 'one target' : `${max} targets`}.` };
  }

  if (assignTargets(specs, src, choices, candidateOf) === null) {
    const wanted = specs.map((s) => s.text).filter((t) => t !== '').join(', ');
    return {
      ok: false,
      message: wanted === ''
        ? `${label} can't target that.`
        : `${label} targets ${wanted} — that choice doesn't fit.`,
    };
  }
  return { ok: true };
}

function untargetableMessage(src: TargetingSource, c: TargetCandidate, label: string): string {
  if (c.shroud) return `That has shroud — nothing can target it, not even your own ${label}.`;
  if (c.hexproof && src.controller !== c.controller) {
    return `That has hexproof — your spells and abilities can't target it.`;
  }
  if (c.protection.fromEverything) return `That has protection from everything.`;
  const hit = c.protection.colors.find((col) => src.colors.includes(col));
  return hit
    ? `That has protection from ${COLOR_NAMES[hit] ?? hit} — ${label} can't target it.`
    : `${label} can't target that.`;
}

const COLOR_NAMES: Readonly<Record<string, string>> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
};

// ── the host adapter ─────────────────────────────────────────────────────────

/**
 * What an object COUNTS AS for targeting.
 *
 * ⚠️ A card type only makes it a "creature"/"artifact"/… while it is ON THE
 * BATTLEFIELD. "Target creature" means a creature PERMANENT; a Grizzly Bears in
 * a graveyard is a creature CARD, which is a different thing and a different
 * clause. Getting this wrong let a Lightning Bolt be aimed at a card in exile —
 * harmless while spells did nothing, and the moment they did it marked damage on
 * an object outside the battlefield and tripped `checkInvariants`.
 */
function kindsFromTypes(types: readonly string[], zone: CandidateZone): TargetKind[] {
  const out: TargetKind[] = [];
  if (zone === 'battlefield') {
    if (types.includes('Creature')) out.push('creature');
    if (types.includes('Planeswalker')) out.push('planeswalker');
    if (types.includes('Battle')) out.push('battle');
    if (types.includes('Artifact')) out.push('artifact');
    if (types.includes('Enchantment')) out.push('enchantment');
    if (types.includes('Land')) out.push('land');
    out.push('permanent');
  }
  if (zone === 'graveyard' || zone === 'exile') out.push('card');
  if (zone === 'stack') out.push('spell');
  return out;
}

export interface HostTargetDeps {
  readonly oracle: OracleDb;
  readonly scripts: ScriptRegistry;
}

/**
 * Every object and player in the game that a spell could be pointed at.
 *
 * ⚠️ Public zones plus living players — never a hand or a library. A candidate
 * list that included hidden cards would be a redaction leak in the one place the
 * UI is guaranteed to render.
 */
export function candidatesFromState(
  state: GameState,
  deps: HostTargetDeps,
  cache: DeriveCache = makeDeriveCache(state),
): TargetCandidate[] {
  const out: TargetCandidate[] = [];

  const pushCard = (id: InstanceId, zone: CandidateZone): void => {
    const card = state.cards[id];
    if (!card) return;
    if (card.phasedOut) return;
    const d = derive(state, deps.oracle, deps.scripts, id, cache);
    out.push({
      choice: { kind: 'card', id },
      zone,
      controller: card.controller,
      kinds: kindsFromTypes(d.typeLine.types, zone),
      types: d.typeLine.types,
      manaValue: deps.oracle.byPrinting(card.printingId)?.manaValue ?? null,
      power: d.power,
      toughness: d.toughness,
      colors: d.colors,
      hexproof: d.keywords.has('hexproof'),
      shroud: d.keywords.has('shroud'),
      protection: d.protection,
    });
  };

  for (const id of state.zones.battlefield) pushCard(id, 'battlefield');
  for (const player of state.seating) {
    for (const id of state.zones.graveyard[player] ?? []) pushCard(id, 'graveyard');
    for (const id of state.zones.exile[player] ?? []) pushCard(id, 'exile');
  }

  for (const obj of state.stack) {
    // ⚠️ **A SPELL ON THE STACK HAS CARD TYPES** — "counter target artifact
    // spell" restricts on them (D198), and they come from the FACE ACTUALLY
    // CAST (D155's rule; a modal DFC's back face is its own spell). An ability
    // has none, so a typed-spell clause refuses it, which is the CR answer.
    const spellCard = obj.card ? state.cards[obj.card] : null;
    const spellOracle = spellCard ? deps.oracle.byPrinting(spellCard.printingId) : undefined;
    out.push({
      choice: { kind: 'stack', id: obj.id },
      zone: 'stack',
      controller: obj.controller,
      kinds: ['spell'],
      types: spellOracle ? faceOf(spellOracle, obj.faceIndex).typeLine.types : [],
      /**
       * ⚠️ **A SPELL ON THE STACK DOES HAVE A MANA VALUE**, and 504 lines in the
       * format restrict on it — `Disdainful Stroke` is "Counter target spell
       * with mana value 4 or greater". Leaving this null to match the other two
       * would make every such counterspell refuse everything, which is the
       * failure mode `targetParse` calls blocking a legal choice.
       *
       * ⚠️ From the PRINTING, not from `derive()`: a spell on the stack has no
       * derive entry at all. An ability (no `card`) genuinely has none.
       */
      manaValue: spellOracle?.manaValue ?? null,
      power: null,
      toughness: null,
      // A stack object's own colours matter only for protection, and nothing
      // targeting the stack has protection. Left empty rather than derived,
      // because a spell on the stack has no `derive()` entry.
      colors: [],
      hexproof: false,
      shroud: false,
      protection: { colors: [], fromEverything: false, other: [] },
    });
  }

  for (const player of state.seating) {
    if (state.players[player]?.hasLost ?? true) continue;
    out.push({
      choice: { kind: 'player', id: player },
      zone: 'player',
      controller: player,
      kinds: ['player'],
      types: [],
      manaValue: null,
      power: null,
      toughness: null,
      colors: [],
      hexproof: false,
      shroud: false,
      protection: { colors: [], fromEverything: false, other: [] },
    });
  }

  return out;
}
