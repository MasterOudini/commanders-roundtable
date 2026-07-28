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
// a granted one needs a layer-6 continuous effect and `EMPTY_REGISTRY` ships, so
// Lightning Greaves does nothing. `tier3.ts` says so on the card.

import type { ColorLetter } from '../data/cardTypes';
import type { InstanceId, PlayerId } from './types/ids';
import type { GameState, TargetChoice } from './types/state';
import type { OracleDb, Protection, TargetKind, TargetSpec } from './types/oracle';
import { derive, makeDeriveCache, type DeriveCache } from './derive';
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
  return true;
}

export function legalTargetsFor(
  spec: TargetSpec,
  src: TargetingSource,
  candidates: readonly TargetCandidate[],
): TargetChoice[] {
  return candidates.filter((c) => targetAllowed(spec, src, c)).map((c) => c.choice);
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
    out.push({
      choice: { kind: 'stack', id: obj.id },
      zone: 'stack',
      controller: obj.controller,
      kinds: ['spell'],
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
      colors: [],
      hexproof: false,
      shroud: false,
      protection: { colors: [], fromEverything: false, other: [] },
    });
  }

  return out;
}
