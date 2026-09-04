// "Does this app execute EVERY word of this card?"
//
// ⚠️ This is D90's rule — never half-execute — generalised from spells to
// permanents, and it exists because the bot needs a deck it cannot lie with.
// A human holding a Tier-3 card reads it and applies it by hand; a bot cannot,
// so a card whose text the engine only partly runs is a card the bot must never
// draw. `tier3.ts` answers the player's question ("what will the app not do for
// me?"); this answers the bot's ("may I be dealt this at all?"), and the two are
// deliberately different questions — see the asymmetry note at the bottom.
//
// ⚠️ IT ASKS THE PARSERS AND WRITES NO RULE OF ITS OWN. That is the same
// discipline `tier3.ts` records learning twice (the Command Tower lesson): a
// second heuristic beside the first is how a claim about coverage starts lying,
// and this one would lie in the expensive direction — dealing the bot a card
// that does nothing when it resolves. Every decision below is delegated to
// `parseFace`, `parseProtection`, `parseWard`, `parseWardLife`,
// `canonicalKeyword`, `parseLandwalk` or `parseToxic`. The only thing written
// here is where one clause ends and the next begins, which is typography
// (CR 207.2 prints keyword abilities one line, comma-separated), not rules.
//
// What the engine actually runs, exhaustively:
//
//  • the intrinsic rules — zones, priority, combat, state-based actions
//  • the Tier-2 keywords in `src/engine/keywords.ts`, plus landwalk,
//    protection from a colour, ward as a fixed price and toxic N
//  • mana abilities `parseManaProduction` can model
//  • instants and sorceries whose EVERY sentence `parseEffects` understood
//  • since M6.4a (D158): ability lines a SHIPPED card script claims — a line
//    counts only when a script in `SHIPPED_SCRIPTS` carries its EXACT printed
//    text on a def the engine actually consults (see `lineClaims` below)
//
// Nothing else. A non-mana activated ability still has no effect even when a
// script carries one — `ActivatedDef` is a seam nothing in the engine consults
// (D158) — so `loop.ts` still resolves it with "with no card scripts there is
// nothing to run", having already charged its cost, and the accounting below
// refuses to let an `activated` def claim a line.

import type { CardData } from './cardTypes';
import type { OracleFace, TargetSpec } from '../engine/types/oracle';
import type { CardScript } from '../engine/scripts/api';
import { SHIPPED_SCRIPTS } from '../engine/scripts/registry';
import { parseFace, parseProtection, parseWard, parseWardLife } from './oracleParse';
import { canonicalKeyword, parseLandwalk, parseToxic } from '../engine/keywords';
import { parseEnchant, scrub, splitAbilityLines } from './targetParse';
import { parseEntersTappedLine, parseChoosesColorOnEntry } from './replacementParse';

export interface Completeness {
  readonly complete: boolean;
  /** The lines nothing accounts for, trimmed. Empty when complete. */
  readonly leftover: readonly string[];
}

/**
 * What KIND of line the engine failed to account for — asked by `tier3.ts`, and
 * drawn here because this is the module that already decides what a line is.
 *
 * ⚠️ Four kinds, because four different notes speak for them, and a disclosure
 * that reported one line twice would go unread exactly as fast as one that never
 * reported it at all (D68's reason for a short keyword list).
 *
 *  • `keyword` — a keyword line the engine does not enforce: `Partner`,
 *    `Prowess`, `Equip {0}`, `Crew 8`. D68 decided the tail of 885 keyword
 *    strings is named from a deliberately SHORT list, which `tier3.ts`'s keyword
 *    loop does. The test is `clauseAccounted`'s own: a printed keyword clause
 *    never contains a period, a semicolon or a colon.
 *  • `activated` — a `cost: effect` line, which `tier3.ts` names WITH its cost,
 *    because the thing a player needs to know is which cost buys nothing.
 *  • `mana` — a line the engine reads a mana ability on and still does not run
 *    whole: it taps the source and adds the mana, and takes no other cost, checks
 *    no condition and applies no second sentence. `Ancient Tomb`, `Rakdos
 *    Signet`, `Phyrexian Tower`, `Temple of the False God`. The one kind where
 *    the engine does PART of the line, so it needs its own words (D124).
 *  • `sentence` — a triggered or static ability. Nothing runs it, and until D122
 *    nothing said so either.
 */
export type UnaccountedKind = 'keyword' | 'activated' | 'mana' | 'sentence';

export interface UnaccountedLine {
  /** Scrubbed and trimmed — the same string `Completeness.leftover` carries. */
  readonly text: string;
  readonly kind: UnaccountedKind;
}

const COMPLETE: Completeness = { complete: true, leftover: [] };

/**
 * Which printed lines the SHIPPED scripts implement, per oracle id — the
 * accounting half of M6.4 (D158). A line is claimed when a def the engine
 * actually consults (`triggers`, `statics`, `replacements`, `combat`) carries
 * its exact printed text; the claim is matched `scrub(text).trim()` against the
 * leftover line, which is provably the only transform between the printed line
 * and what `linesUnaccounted` compares (both descend from the same DB bytes —
 * the def's `text` is `printed()`-guarded against the fixture, the fixture is
 * byte-guarded against the live database).
 *
 * ⚠️ PER LINE, NEVER PER CARD. A script covering one of a card's two ability
 * lines must not silence the other — that would be D90's half-execution wearing
 * an accounting entry. A def whose `text` spans lines contains `\n`, can never
 * match a leftover line, and the gate refuses the card — failing in the safe
 * direction.
 *
 * ⚠️ TWO HALVES, AND A LINE IS CLAIMABLE ONLY BY ITS OWN KIND (D159). A
 * `cost: effect` line may be claimed only by an `ActivatedDef` — the def kind
 * `resolveAbility` consults for an activated object — and a sentence only by
 * the trigger/static/replacement/combat kinds. Before the activated seam
 * existed, activated defs were excluded outright, because honouring a claim
 * from a def nothing consults would tell the player a cost buys an effect the
 * engine charges and never runs (D122's bug through the accounting); the
 * structure keeps that guarantee per kind now that both sides are consulted.
 *
 * ⚠️ KEYED ON `SHIPPED_SCRIPTS`, THE NAMED LIST, never on a registry parameter.
 * The TEST registry's scripts (`Ajani's Mantra`, `Yotian Dissident`) must stay
 * refused here, or `shippedScripts.node.test.ts`'s teeth check would go green
 * over nothing.
 */
export interface LineClaims {
  readonly sentences: ReadonlySet<string>;
  readonly activated: ReadonlySet<string>;
}

export function lineClaims(scripts: readonly CardScript[]): ReadonlyMap<string, LineClaims> {
  const out = new Map<string, { sentences: Set<string>; activated: Set<string> }>();
  const entry = (oracleId: string) => {
    const got = out.get(oracleId) ?? { sentences: new Set<string>(), activated: new Set<string>() };
    out.set(oracleId, got);
    return got;
  };
  for (const s of scripts) {
    const defs = [
      ...(s.triggers ?? []),
      ...(s.statics ?? []),
      ...(s.replacements ?? []),
      ...(s.combat ?? []),
    ];
    for (const d of defs) {
      const t = scrub(d.text).trim();
      if (t !== '') entry(s.oracleId).sentences.add(t);
    }
    for (const d of s.activated ?? []) {
      const t = scrub(d.text).trim();
      if (t !== '') entry(s.oracleId).activated.add(t);
    }
    // A SPELL def carries the cast face's WHOLE printed text (SpellDef's
    // contract) while the accounting matches per LINE — split it, so a
    // multi-line spell claims each of its lines and a def that stopped short
    // leaves a leftover the gate refuses (D90). Spell lines are sentences,
    // never `cost: effect` lines, so they join the sentence kind.
    if (s.spell) {
      for (const line of s.spell.text.split('\n')) {
        const t = scrub(line).trim();
        if (t !== '') entry(s.oracleId).sentences.add(t);
      }
    }
  }
  return out;
}

const SHIPPED_CLAIMS = lineClaims(SHIPPED_SCRIPTS);

/**
 * The `ref` of every SHIPPED `ActivatedDef` — `tier3.ts`'s key for silencing
 * the per-ability notes, built HERE beside the line claims so both derive from
 * the same defs at one site. The two keys (text for lines, ref for abilities)
 * cannot drift apart silently: a def whose `text` and `ref` disagree about
 * which ability it is leaves either a leftover line or a live note, and
 * `shippedScripts.node.test.ts` refuses the card either way.
 */
export const SHIPPED_ACTIVATED_REFS: ReadonlySet<string> = new Set(
  SHIPPED_SCRIPTS.flatMap((s) => (s.activated ?? []).map((d) => d.ref)),
);

/**
 * Every oracleId whose SHIPPED script carries a SPELL def — `tier3.ts`'s key
 * for silencing the "Its effect" / "Part of its effect" notes, the spell
 * mirror of `SHIPPED_ACTIVATED_REFS` (D159's idiom): built HERE beside the
 * line claims so the disclosure and the accounting derive from the same
 * defs at one site. A def that claimed the lines but left the note live —
 * or silenced the note without claiming the lines — fails
 * `shippedScripts.node.test.ts` either way.
 */
export const SHIPPED_SPELL_ORACLES: ReadonlySet<string> = new Set(
  SHIPPED_SCRIPTS.filter((s) => s.spell !== undefined).map((s) => s.oracleId),
);

/**
 * One clause of a keyword line, or a whole line offered as a single clause.
 *
 * ⚠️ Every branch ASKS a parser and then cross-checks the FACE. Asking the
 * parser alone would accept "Whenever a creature with flying attacks" if it were
 * ever split to just `flying`; asking the face alone would accept a card that
 * has flying for a line that says something else entirely. Both together mean a
 * clause counts only when the ingest reads it AND the engine ended up enforcing
 * it on this card.
 */
function clauseAccounted(raw: string, face: OracleFace): boolean {
  const s = raw.trim().replace(/\.$/, '').trim();
  if (s === '') return true;

  // ⚠️ A CLAUSE MUST *BE* A KEYWORD, NEVER MERELY CONTAIN ONE — and this guard
  // is here because the first version did not have it and the generator picked
  // `Jedit Ojanen, Mercenary` as the bot's COMMANDER. His whole card is a
  // triggered ability, and it was accepted because it ends "…creature token
  // with forestwalk", `parseLandwalk` is a substring test, and the face really
  // does have landwalk. `keywords.ts`'s own header warns about exactly this
  // shape: a regex over oracle text "finds 'flying' inside 'Whenever a creature
  // with flying attacks…' and grants it to the wrong card."
  //
  // A printed keyword clause never contains a period, a semicolon or a colon.
  // Anything that does is a sentence or an ability line, and the branches below
  // — four of which locate their clause by prefix — must not see it.
  if (/[.;:]/.test(s)) return false;

  const kw = canonicalKeyword(s);
  if (kw !== null) return face.keywords.includes(kw);

  // Anchored at BOTH ends for the same reason, then confirmed by the parser: a
  // clause shaped like landwalk that `parseLandwalk` does not read is not one.
  if (/^\w+walk$/i.test(s) || /^(?:legendary|snow) landwalk$/i.test(s)) {
    return parseLandwalk(s).length > 0 && face.landwalk.length > 0;
  }

  if (/^protection from\b/i.test(s)) {
    const p = parseProtection(s);
    // ⚠️ `other` is the parser's own record of a clause it read but does NOT
    // enforce — protection from a card type, a name, a permanent. One entry is
    // enough to disqualify: the engine would let the bot be blocked by, or
    // target, something the card says it cannot be.
    return p.other.length === 0 && (p.colors.length > 0 || p.fromEverything);
  }

  // ⚠️ `ward—Discard a card` is a decision, not a price (D68), and `parseWard`
  // reports null for it. That is the whole test; there is no second reading of
  // what a ward costs here.
  if (/^ward\b/i.test(s)) return parseWard(s) !== null || parseWardLife(s) > 0;

  if (/^toxic \d+$/i.test(s)) return parseToxic(s) > 0 && face.toxicAmount > 0;

  return false;
}

/**
 * A line carrying a mana ability AND NOTHING ELSE.
 *
 * ⚠️ `ManaProduction.line` says the line HAS a mana ability, never that the line
 * IS one, and the difference is a card the bot would break. `Ancient Tomb` reads
 * `{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.` on one line: the engine
 * taps it, adds two colourless and deals nobody any damage. It is not
 * `conditional` either — there is no "if", "unless" or "only" in it — so the
 * mana-line index alone accepted it, which is exactly the half-execution this
 * module exists to refuse. Counting sentences is the same kind of typographic
 * rule as splitting a keyword line on commas: the parser has already proved the
 * FIRST sentence is an `Add` it can model, and this asks whether there is a
 * second one it was never shown.
 */
function isManaOnlyLine(line: string): boolean {
  const colon = line.indexOf(':');
  const effect = colon >= 0 ? line.slice(colon + 1) : line;
  const sentences = effect.split(/(?<=[.!])\s+/).filter((s) => s.trim() !== '');
  return sentences.length <= 1;
}

/**
 * A line printed as keyword abilities and nothing else.
 *
 * ⚠️ The WHOLE line is offered first, because `protection from white and from
 * blue` is one clause containing the word the split would cut on. Only if that
 * fails is the line treated as a comma-separated list, which is how a multi-
 * keyword line is printed.
 */
function isKeywordLine(line: string, face: OracleFace): boolean {
  if (clauseAccounted(line, face)) return true;
  const parts = line.split(',');
  if (parts.length < 2) return false;
  return parts.every((p) => clauseAccounted(p, face));
}

/** Does this clause OPEN with one of the keywords Scryfall printed on the card? */
function startsWithPrintedKeyword(clause: string, printed: readonly string[]): boolean {
  const s = clause.trim().toLowerCase();
  return printed.some((raw) => {
    const kw = raw.trim().toLowerCase();
    if (kw === '' || !s.startsWith(kw)) return false;
    // ⚠️ A WORD BOUNDARY, and `Equip` against `Equipped creature has haste and
    // shroud.` is the whole reason — a prefix test alone would file that granted
    // ability as the Equip keyword and say nothing about it. Same for `Enchant`
    // and `Enchanted creature can't attack or block.`
    const next = s.charAt(kw.length);
    if (next !== '' && /[a-z]/i.test(next)) return false;
    // ⚠️ A SPACED EM DASH IS AN ABILITY WORD, and Scryfall's typography is what
    // draws the line: a keyword's COST follows an unspaced dash (`Ward—Discard a
    // card.`), an ability word introduces a whole ability after a spaced one
    // (`Threshold — This creature gets +1/+1.`). Without this, a comma-less
    // ability word is filed as its keyword and the ability it introduces goes
    // unmentioned — measured at 126 Commander-legal cards before this line
    // existed, `Threshold`, `Fateful hour` and `Metalcraft` among them.
    return !/^\s+[—–]\s/.test(s.slice(kw.length));
  });
}

/**
 * The same question `isKeywordLine` asks, one step out: is this a keyword line at
 * all — enforced or not?
 *
 * ⚠️ THE KEYWORD TAIL IS SOMEBODY ELSE'S JOB. D68 decided that the 885 distinct
 * unautomated keyword strings are named from `tier3.ts`'s deliberately SHORT list
 * rather than in full, so a bare `Partner`, `Prowess` or `Ward—Discard a card.`
 * must not also be reported as unrun ability text — Partner is in fact enforced,
 * by the deck validator, and a note on every card carrying any of the tail would
 * be the furniture this file's most important test exists to prevent.
 *
 * ⚠️ ASKED OF SCRYFALL'S `keywords`, which is the same input the keyword loop
 * reads. `canonicalKeyword` cannot answer it — it knows the Tier-2 keywords only,
 * so it calls `Partner` an ability rather than a keyword.
 *
 * ⚠️ AND SPLIT ON COMMAS, which is what keeps an ABILITY WORD out. Scryfall lists
 * `Magecraft` in `keywords`, so `Magecraft — Whenever you cast or copy an instant
 * or sorcery spell, create a 1/1 …` opens with a printed keyword and is a full
 * triggered ability — the shape a prefix test alone would silence. A keyword
 * clause is a keyword and its cost; a rules sentence has a clause after the comma
 * that is not one (CR 603.1 templating puts a comma after every trigger
 * condition), and that second clause is what tells them apart.
 */
function isPrintedKeywordLine(line: string, printed: readonly string[]): boolean {
  if (printed.length === 0) return false;
  return line.split(',').every((p) => p.trim() === '' || startsWithPrintedKeyword(p, printed));
}

/**
 * Every line of one face that nothing in the engine accounts for, in printed
 * order, each labelled with what kind of line it is.
 *
 * ⚠️ THE LINE ACCOUNTING ALONE. `faceCompleteness` wraps this with two things
 * that are not about lines — a target clause the parser could not read, and an
 * instant or sorcery whose every sentence WAS read — and `tier3.ts` says both of
 * those separately already. Sharing the line loop rather than the verdict is what
 * lets the disclosure and the bot's pool predicate stay two questions with one
 * answer underneath: a card this reports nothing for is a card `tier3.ts` stays
 * silent about, which is the invariant at the bottom of this file.
 */
/**
 * D304 - THE AURA SEAM. An Enchant spec the engine ENFORCES: kinds it read,
 * nothing left unenforced, and never a player (an Aura on a player has no
 * InstanceId to attach to - the cast keeps today's outcome). The cast aims by
 * the spec and CR 704.5m's state-based check asks it of the host on every pass
 * (`sba.ts`), so the line is the engine's own, exactly as a mana line is.
 */
export function enchantSpecRuns(spec: TargetSpec): boolean {
  return spec.kinds.length > 0 && spec.unenforced.length === 0 && !spec.kinds.includes('player');
}

/** D304 - the Enchant line of an Aura whose one target is a spec the engine enforces. */
export function enchantLineRuns(line: string, face: OracleFace): boolean {
  if (!/^enchant\b/i.test(line)) return false;
  if (parseEnchant(line) === null) return false;
  const spec = face.targets.length === 1 ? face.targets[0] : undefined;
  return spec !== undefined && enchantSpecRuns(spec);
}

function linesUnaccounted(
  rawText: string,
  face: OracleFace,
  printedKeywords: readonly string[],
  claims?: LineClaims,
): UnaccountedLine[] {
  // ⚠️ Scrubbed, so reminder text and text the card GRANTS TO SOMETHING ELSE do
  // not count against it — and `scrub` blanks in place, so line indices still
  // line up with `ManaProduction.line` and with `splitAbilityLines`, both of
  // which index into the RAW text.
  const lines = scrub(rawText).split('\n');
  const kinds = new Map(splitAbilityLines(rawText, face.isPermanent).map((l) => [l.index, l.kind]));

  // ⚠️ ONLY A PERMANENT'S. `parseManaProduction` reads any face with the word
  // "add" on it, and `legalActions` offers `TapForMana` for battlefield
  // permanents alone — so `Dark Ritual`'s `Add {B}{B}{B}.` is a spell effect
  // that is NOT in `parseEffects`' vocabulary, wearing a mana ability's clothes.
  // Counting it accepted a sorcery that resolves and does nothing at all.
  //
  // ⚠️ TWO SETS, because "the engine models this line" and "there is a mana
  // ability on this line" are different facts and the second one is what a
  // DISCLOSURE needs. `modelled` decides completeness, exactly as before:
  // `conditional` sources are excluded even though the engine can tap them,
  // because the reason they are conditional is never enforced and the bot would
  // ignore it. `anyMana` is every line a mana ability was read on, conditional or
  // not, so `tier3.ts` can say the engine will tap this and do nothing else —
  // which is true of a conditional source and of a modelled one that carries a
  // second sentence, and of nothing else.
  const modelled = new Set<number>();
  const anyMana = new Set<number>();
  if (face.isPermanent) {
    for (const p of face.producesMana) {
      if (p.line === null) continue;
      anyMana.add(p.line);
      if (!p.conditional) modelled.add(p.line);
    }
  }

  const out: UnaccountedLine[] = [];
  for (const [i, text] of lines.entries()) {
    const line = text.trim();
    if (line === '') continue;
    if (modelled.has(i) && isManaOnlyLine(line)) continue;
    // ⚠️ ASKED OF THE PARSER THAT DECIDED IT, never re-read here — the fourth
    // time this file has had to say so. `face.entersTapped` is already the
    // answer to "is this the unconditional clause"; a second regex here would
    // eventually accept an `unless` the parser refused, and the engine would tap
    // a land whose condition nobody checked. See D134.
    if (face.entersTapped && parseEntersTappedLine(line, face.name)) continue;
    // ⚠️ Same rule, one clause along (D147): ASKED OF THE PARSER that set the
    // flag, never re-read here. `face.choosesColorOnEntry` is already the answer
    // to "is this the colour-choice clause", and it is deliberately narrow — a
    // second regex here would eventually accept "choose a creature type", which
    // the engine asks nobody about and nothing reads.
    if (face.choosesColorOnEntry && parseChoosesColorOnEntry(line)) continue;
    // D304 - an Enchant line the engine RUNS (see `enchantLineRuns`).
    if (enchantLineRuns(line, face)) continue;
    // D305 - an Equip line the engine RUNS: `activatedParse` synthesized the
    // ability (a mana cost, the sorcery-speed attach), the offer and the charge
    // are the activated seam's, the attach is `resolveAbility`'s own. Asked of
    // the parser that decided it (D134), never re-read here.
    if (face.activated.some((a) => a.equip !== undefined && a.equip.line === line)) continue;
    // D306 - a Cycling line the engine RUNS (the synthesized ability: offered
    // from the hand, the discard charged, the draw resolved natively).
    if (face.activated.some((a) => a.cycling !== undefined && a.cycling.line === line)) continue;
    // D311 - a Crew line the engine RUNS (the synthesized ability: the tap
    // chooser charged by power, the Vehicle animated natively).
    if (face.activated.some((a) => a.crew !== undefined && a.crew.line === line)) continue;
    // D307 - a Flashback line the engine RUNS (cast from the graveyard for
    // that cost, exiled on leaving the stack). Asked of the parser that read it.
    if (face.flashbackCost !== null && /^Flashback (?:\{[^}]+\})+$/.test(line)) continue;
    // D309 - a Morph / Megamorph line the engine RUNS (cast face down for {3},
    // turned face up for the cost). Asked of the parser that read it.
    if (face.morphCost !== null && /^(?:Morph|Megamorph) (?:\{[^}]+\})+$/.test(line)) continue;
    if (isKeywordLine(line, face)) continue;
    // ⚠️ `mana` outranks `activated`, because a mana ability never reaches the
    // stack (CR 605) and is never offered by `ActivateAbility` — so the note that
    // names an ability by its cost would be describing a code path this line
    // cannot take. `activated` then wins over the rest, and it is asked of
    // `splitAbilityLines` rather than re-read here: a colon can sit inside text
    // the card GRANTS to something else, where scrub blanks it, and no two
    // consumers may claim the same line.
    //
    // ⚠️ AND `mana` REQUIRES AN ACTIVATED LINE, which is not a formality. A mana
    // ability is an activated ability by definition (CR 605.1a), but
    // `parseManaProduction` tests any line for the word "add" and takes the whole
    // line as the effect when there is no colon — so it records a production for
    // `Whenever this creature attacks, add {R}` too. Labelling that `mana` told
    // 193 cards "the app taps it and adds the mana" about a TRIGGER the app does
    // not notice at all, which is a confidently wrong disclosure of exactly the
    // kind this module exists to prevent. They stay `sentence`, where D122's
    // "nothing happens by itself" is the true answer.
    const isActivated = kinds.get(i) === 'activated';
    // ⚠️ THE SHIPPED-SCRIPT CLAIM, LAST in the ladder — after every built-in
    // account, so no two consumers claim one line — and MATCHED BY KIND: a
    // `cost: effect` line is claimable only by an `ActivatedDef` (the kind the
    // resolution consults for an activated object since D159), a sentence only
    // by the trigger/static/replacement/combat kinds. Structural, not trusted:
    // a def of the wrong kind carrying this line's text cannot silence it.
    if (claims && (isActivated ? claims.activated.has(line) : claims.sentences.has(line))) continue;
    const kind: UnaccountedKind =
      isActivated && anyMana.has(i)
        ? 'mana'
        : isActivated
          ? 'activated'
          : isPrintedKeywordLine(line, printedKeywords)
            ? 'keyword'
            : 'sentence';
    out.push({ text: line, kind });
  }
  return out;
}

/** `linesUnaccounted` for one face of a card, parsing the face on the way. */
export function unaccountedLines(card: CardData, faceIndex: number): readonly UnaccountedLine[] {
  const raw = card.faces[faceIndex] ?? card.faces[0];
  if (!raw) return [];
  return linesUnaccounted(
    raw.oracleText ?? '',
    parseFace(card, faceIndex),
    card.keywords,
    SHIPPED_CLAIMS.get(card.oracleId),
  );
}

/** Whether the engine runs every word of one face. */
export function faceCompleteness(card: CardData, faceIndex: number): Completeness {
  const raw = card.faces[faceIndex];
  if (!raw) return { complete: false, leftover: ['(no such face)'] };
  const face = parseFace(card, faceIndex);

  // ⚠️ A CLAUSE THE PARSER COULD NOT READ IS FREE AIM — `kinds: []` with
  // `min: 0` (D79) — which is the right answer for a human, who knows what the
  // card means, and the wrong one for a bot, which would aim at nothing and
  // watch the effect skip itself. `unenforced` is the same failure one step in:
  // the KIND of object is checked and the restriction on it is not, so the bot
  // would happily Bolt a creature the card says it cannot touch.
  const specs = [...face.targets, ...face.activated.flatMap((a) => a.targets)];
  const unread = specs.filter((s) => s.kinds.length === 0 || s.unenforced.length > 0);
  if (unread.length > 0) {
    return { complete: false, leftover: unread.map((s) => s.text || '(a target clause nothing read)') };
  }

  // ⚠️ `effectMode === 'auto'` already means EVERY sentence of an instant or
  // sorcery was understood — `parseEffects` counts them and anchors each pattern
  // at both ends. So it settles the whole face, and there is nothing left to
  // check line by line.
  if (face.effectMode === 'auto') return COMPLETE;

  const leftover = linesUnaccounted(
    raw.oracleText ?? '',
    face,
    card.keywords,
    SHIPPED_CLAIMS.get(card.oracleId),
  ).map((l) => l.text);
  return leftover.length === 0 ? COMPLETE : { complete: false, leftover };
}

/**
 * Whether the engine runs every word of EVERY face.
 *
 * ⚠️ Every face, not the front one. A split card can be cast either half, an
 * adventure has two spells, and a transforming permanent can be turned over with
 * the Tier-3 tool — so a back face the engine cannot run is a back face the bot
 * must not be holding.
 */
export function engineCompleteness(card: CardData): Completeness {
  const leftover: string[] = [];
  for (let i = 0; i < card.faces.length; i++) {
    leftover.push(...faceCompleteness(card, i).leftover);
  }
  return leftover.length === 0 ? COMPLETE : { complete: false, leftover };
}

export function isEngineComplete(card: CardData): boolean {
  return engineCompleteness(card).complete;
}

// ⚠️ THE ASYMMETRY WITH `tier3.ts`, STATED, because it is the one thing about
// this module that looks like a bug and is not.
//
// Everything this accepts produces zero Tier-3 notes — asserted in the tests,
// and it must stay true, because a card the app tells the player it handles
// completely is exactly a card the bot may hold.
//
// The converse is FALSE, and deliberately so: this module refuses a card for
// reasons a player does not need told (a free-aim target clause is the honest
// answer for a human and a useless one for a bot), so a rejection here is not on
// its own a Tier-3 note.
//
// ⚠️ It USED to be false for two reasons that were simply gaps, and D122 closed
// both: `tier3NotesFor` said nothing about a permanent's triggered and static
// text — `parseEffects` returns `manual` for every permanent by construction and
// the "Its effect" note is raised only for a non-permanent — and nothing about a
// payable non-mana activated ability, which `legal.ts` offers and `loop.ts`
// resolves by running nothing. A creature reading "Whenever this creature
// attacks, draw a card" drew no note and did nothing. Both now ask
// `unaccountedLines` above, which is why they cannot drift from this predicate.
