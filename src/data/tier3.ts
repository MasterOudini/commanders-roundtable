// "What this app does NOT do for this card."
//
// ⚠️ The other half of the Tier-2 decision, and the half that is easy to skip.
// D68 decided that several measured categories stay Tier 3 — protection from a
// card type, a mana ability whose amount depends on the board, a ward that is a
// decision rather than a price, and the long tail of ~885 keyword strings. A
// category left unenforced and left UNSAID is indistinguishable, from the
// player's side, from a category that is enforced and broken. This module is
// what makes the difference visible on the card itself.
//
// ⚠️ It says what the app does not do, never what the card does. Explaining a
// card would be a second, unmaintainable rules text that drifts from Scryfall's
// the moment Wizards rewords something; the card's own text is right there
// above it. "Crew is not automatic — tap the crew yourself" is a fact about
// this application and will stay true.
//
// ⚠️ D122 and D124 added the three categories this file was silent about, all
// found while building the bot (D121) and all of them the same failure as an
// unenforced keyword, one step deeper:
//
//  • a PERMANENT's triggered and static text, which `parseEffects` cannot speak
//    for because it reads instants and sorceries only;
//  • a PAYABLE non-mana activated ability, which the engine charges and then does
//    not run;
//  • the half of a MANA line that is not "add mana" — the engine taps the source
//    and adds the mana and takes no other cost, which is the one case where it
//    does part of a line and carries on.
//
// None of the three changed what the engine does. Silence had been claiming
// coverage in all of them, on 16,020 of 31,692 Commander-legal cards.
//
// Pure, offline, and driven by the same two inputs the ingest uses — Scryfall's
// `keywords[]` and the oracle text — so it cannot claim coverage the parser does
// not have.

import type { CardData, CardFace } from './cardTypes';
import { canonicalKeyword } from '../engine/keywords';
import { parseManaCost, parseManaProduction, parseTypeLine } from './oracleParse';
import { isPermanentType } from './oracleParse';
import { parseSpellTargets } from './targetParse';
import { parseActivatedAbilities } from './activatedParse';
import { parseEffects } from './effectParse';
import { SHIPPED_ACTIVATED_REFS, unaccountedLines } from './engineComplete';

export interface Tier3Note {
  /** Short label, e.g. "Crew". */
  readonly what: string;
  /** What the player does instead. Active voice, from their side. */
  readonly how: string;
}

/**
 * The label for a permanent's unrun triggered and static text (D122).
 *
 * ⚠️ ONE label for both, and that is a decision rather than laziness.
 * `splitAbilityLines` calls a line `triggered` only when it STARTS with "When",
 * "Whenever", "At the beginning" or "At end of", so every ability-word line —
 * `Magecraft — Whenever you cast…`, `Landfall — Whenever a land enters…` — comes
 * back as `static`. Two labels would therefore have told a Sedgemoor Witch player
 * to treat a trigger as an always-on rule, and this file's whole argument is that
 * a disclosure which is confidently wrong is worse than one that is coarse. What
 * a player has to know is identical either way: the app does not run this.
 *
 * Exported so `tier3.node.test.ts` can attribute a note to this branch when it
 * measures the population — never to build a note anywhere else.
 */
export const ABILITY_TEXT_NOTE = 'Its ability text';

/**
 * The label for a mana line the engine runs only PART of (D124).
 *
 * ⚠️ NOT the same statement as `Its mana ability` below, and the difference is the
 * whole reason it is a second note: that one means the app will not tap the source
 * at all, so tap it yourself. This one means the app WILL tap it and add the mana,
 * and will do nothing else printed on that line — which is the opposite half, and
 * saying either sentence in the other's place would send a player to the manual
 * tools for something already done or leave them believing a cost was taken.
 */
export const MANA_PART_NOTE = 'Part of its mana ability';

/** The label for one activated ability, named by the cost the player pays. */
export function abilityNoteLabel(costText: string): string {
  return `Its “${costText}” ability`;
}

/**
 * The keywords worth naming individually, because a player is likely to expect
 * them to be automatic and to be caught out when they are not.
 *
 * ⚠️ Deliberately a SHORT list. Naming all 885 would produce a wall of text on
 * every card and would be read by nobody, which is the same outcome as saying
 * nothing while feeling more thorough.
 */
const NAMED: Readonly<Record<string, string>> = {
  crew: 'tap creatures with total power ≥ the crew number yourself',
  equip: 'move the Equipment with the card menu, and pay for it yourself',
  enchant: 'attach the Aura with the card menu',
  cycling: 'discard it and draw with the manual tools',
  flashback: 'cast it from the graveyard with the manual tools',
  kicker: 'pay the extra cost yourself and apply the effect',
  multikicker: 'pay the extra cost yourself and apply the effect',
  morph: 'turn it face down with the card menu',
  regenerate: 'apply the shield yourself',
  prowess: 'add the bonus yourself with the counters tool',
  convoke: 'tap the creatures yourself',
  delve: 'exile the cards yourself',
  suspend: 'use counters and cast it when they run out',
  madness: 'cast it from the graveyard with the manual tools',
  cascade: 'reveal and cast with the manual tools',
  storm: 'copy the spell yourself',
  proliferate: 'add the counters yourself',
  changeling: 'it is not treated as every creature type',
  phasing: 'phase it in and out with the manual tools',
  banding: 'agree the damage assignment at the table',
};

/** Ward forms the engine charges. Anything else is a decision, not a price. */
const ENFORCED_WARD = /\bward\s*(?:\{[^}]+\}|[—–-]\s*pay\s+\d+\s+life\b)/i;

/**
 * Every Tier-3 note for one face, in the order a player would care about them.
 *
 * Returns an empty array for a card the engine handles completely — a vanilla
 * creature, a basic land — which is the common case and must stay silent.
 */
export function tier3NotesFor(card: CardData, faceIndex = 0): Tier3Note[] {
  const face: CardFace | undefined = card.faces[faceIndex] ?? card.faces[0];
  if (!face) return [];
  const text = face.oracleText ?? '';
  const notes: Tier3Note[] = [];
  const seen = new Set<string>();
  const add = (what: string, how: string): void => {
    const key = what.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    notes.push({ what, how });
  };

  // ⚠️ Protection is the one where the app enforces PART of the keyword. Saying
  // "protection is not automatic" would be a lie; saying nothing would let a
  // player assume `protection from Dragons` is being checked. Name the clause.
  for (const m of text.matchAll(/protection from ([^.;\n(]+)/gi)) {
    const clause = (m[1] ?? '').trim().toLowerCase().replace(/\.$/, '');
    if (clause === '') continue;
    if (/^(white|blue|black|red|green|everything|all colors|all colours)$/.test(clause)) continue;
    // A multi-part clause of colours is enforced too ("black and from red").
    if (/^(white|blue|black|red|green)(\s*(,|and from|and)\s*(white|blue|black|red|green))*$/.test(clause)) {
      continue;
    }
    add(`Protection from ${clause}`, 'check it yourself — only protection from a colour is automatic');
  }

  if (/\bward\b/i.test(text) && !ENFORCED_WARD.test(text)) {
    add('Ward', 'the cost is not a fixed price, so pay it at the table');
  }

  // ⚠️ A mana ability the solver cannot model stays manually tappable, and
  // naming it is what stops "why is this land greyed out" being a mystery.
  //
  // ⚠️ ASKED OF THE PARSER, never re-guessed here. The first version of this
  // used its own regex and flagged Command Tower — which the parser handles
  // exactly, because an identity-scoped "any color" is not conditional (the
  // engine knows the controller's commander identity). A second heuristic
  // beside the first is precisely how a disclosure starts lying: it would have
  // told players to tap Command Tower by hand, on a land the app taps for them.
  if (/\badd\b/i.test(text)) {
    const manaWarnings: string[] = [];
    parseManaProduction(face, parseTypeLine(face.typeLine), (c) => manaWarnings.push(c));
    if (manaWarnings.length > 0) {
      add('Its mana ability', 'tap it yourself and add the mana with the mana tool');
    }
  }

  // ⚠️ TARGETING, ASKED OF THE PARSER — never re-derived with a `/target/` regex
  // here. That is the same rule the mana note above follows, for the same
  // measured reason: a second heuristic beside the first is precisely how a
  // disclosure starts lying, and this one would lie in the direction that
  // matters, telling a player to check something the app is in fact checking.
  const isPermanent = isPermanentType(parseTypeLine(face.typeLine));
  const specs = parseSpellTargets(text, isPermanent);
  const abilities = parseActivatedAbilities({
    oracleText: text,
    isPermanent,
    producesMana: parseManaProduction(face, parseTypeLine(face.typeLine)),
    parseCost: parseManaCost,
  });
  const allSpecs = [...specs, ...abilities.flatMap((a) => a.targets)];

  // ⚠️ WHETHER THE CARD'S EFFECT HAPPENS BY ITSELF, said on the card. This is
  // the most important disclosure in this file now that some spells execute:
  // "did that resolve, or do I have to do it?" is otherwise unanswerable from
  // the table, and guessing wrong in either direction ruins a game.
  const parsedEffects = parseEffects(
    text,
    face.name,
    parseTypeLine(face.typeLine).types.some((t) => t === 'Instant' || t === 'Sorcery'),
  );
  if (parsedEffects.mode === 'assisted') {
    add('Part of its effect', 'the app offers the part it understands when this resolves — the rest is yours');
  } else if (parsedEffects.mode === 'manual' && !isPermanent) {
    add('Its effect', 'read it and apply it with the manual tools — the app does not run this one');
  }

  // ⚠️ A PERMANENT'S OWN TEXT, which the note above cannot speak for and which
  // went unsaid until D122. `parseEffects` reads INSTANTS AND SORCERIES ONLY, by
  // construction — a permanent's text is a triggered or static ability that needs
  // the script registry and the trigger bus rather than a one-shot resolution —
  // so `mode` is `manual` for every permanent and the branch above excludes them
  // deliberately. The result was that `Wall of Omens` and `Talrand, Sky Summoner`,
  // both shipping in the starter decks, produced ZERO notes, and zero notes is
  // what a vanilla Grizzly Bears produces: the hover panel's silence reads as "the
  // app handles this card completely" while `SHIPPED_REGISTRY` runs none of it.
  //
  // ⚠️ ASKED OF `engineComplete`, never re-derived here — the third time this file
  // applies that rule, for the reason the mana and targeting notes above give. Its
  // line accounting is what the bot's own pool predicate uses, so this cannot
  // claim a gap the bot is not also refused, and a card the predicate accepts
  // stays silent (`engineComplete.test.ts` asserts that direction).
  //
  // ⚠️ SENTENCE lines only. A keyword line the engine does not enforce belongs to
  // the keyword loop below and D68's deliberately short list; an activated line is
  // named with its cost by the ability loop. Saying either of them here would be
  // reporting one line twice.
  if (isPermanent) {
    const unrun = unaccountedLines(card, faceIndex);
    if (unrun.some((l) => l.kind === 'sentence')) {
      add(ABILITY_TEXT_NOTE, 'nothing happens by itself — read it and use the manual tools when it applies');
    }

    // ⚠️ THE ONE PLACE THE APP DOES PART OF A LINE AND CARRIES ON (D124).
    // `tapForMana` taps the permanent and emits `ManaAdded`, and that is all it
    // does: it takes no cost beyond the tap, checks no activation condition,
    // tracks no once-per-turn limit and applies no second sentence. So
    // `Rakdos Signet` hands over {B}{R} without ever taking its {1},
    // `Phyrexian Tower` makes {B}{B} with nothing sacrificed, `Temple of the
    // False God` works on two lands, and `Ancient Tomb` deals nobody the 2
    // damage printed on the same line as its mana.
    //
    // ⚠️ ONE note for all four reasons a line lands here — an extra cost, an
    // activation condition, a spend restriction, an amount that depends on the
    // board — because `ManaProduction.conditional` is a single flag that ORs them
    // together and does not record which applied. Splitting the note would mean
    // re-deriving the reason from the text beside the parser that already decided
    // it, which is the mistake this file has now recorded learning three times.
    // The `how` names all four instead, which is true of every card in the set.
    if (unrun.some((l) => l.kind === 'mana')) {
      add(
        MANA_PART_NOTE,
        'the app taps it and adds the mana — any other cost, condition or restriction on that line is yours',
      );
    }
  }

  if (allSpecs.some((s) => s.kinds.length === 0)) {
    add('Its targets', 'aim at anything — the app cannot read this card’s targeting rule, so it does not check it');
  }
  const unenforced = [...new Set(allSpecs.flatMap((s) => s.unenforced))].filter((u) => u !== '');
  if (unenforced.length > 0) {
    add(`“${unenforced.slice(0, 2).join('”, “')}” on its target`, 'check it yourself — only the KIND of object is checked');
  }
  for (const ability of abilities) {
    if (ability.isManaAbility) continue;

    // ⚠️ A SHIPPED `ActivatedDef` RUNS THIS ABILITY COMPLETELY (D159) — cost
    // charged by the engine, effect resolved by the script — so the card owes
    // the player no note for it. Keyed by the ability's `ref`, built in
    // `engineComplete.ts` beside the line claims so both silences derive from
    // one set of defs.
    if (SHIPPED_ACTIVATED_REFS.has(`${card.oracleId}#a${ability.index}`)) continue;

    // ⚠️ A SELF-SACRIFICE COST IS CHARGEABLE SINCE D159 AND OFFERED ONLY WHEN A
    // SCRIPT WILL RUN THE EFFECT — and since D168 the same holds for a
    // sacrifice-cost CHOOSER (`sacrificeCost`, "Sacrifice a creature") — for
    // this card there is no script, so the app will not offer the ability at
    // all, and the note says the manual route rather than promising a charge
    // that `legal.ts` refuses to make.
    if (ability.sacrificesSelf || ability.sacrificeCost) {
      add(
        abilityNoteLabel(ability.costText),
        'pay that cost with the manual tools, then apply the effect at the table',
      );
      continue;
    }

    // ⚠️ PAYABLE IS NOT RUN, AND THE COST IS TAKEN ANYWAY (D122). `payable` means
    // the engine can charge the COST, never that it can run the EFFECT:
    // `legal.ts` offers every ability that is
    // `payable && !isManaAbility && !isLoyalty`, `handlers.ts` taps the permanent
    // and takes the mana, and `loop.ts` resolves it with "with no card scripts
    // there is nothing to run" — unless a shipped def claimed it above.
    // `Krenko, Mob Boss` is a starter commander — tap
    // him, get no Goblins — and this file skipped him precisely BECAUSE he was
    // payable. What the engine does is not this file's to change; saying it is.
    //
    // The condition mirrors `legal.ts`'s so the two can be read against each
    // other. `activatedParse` already makes `payable` false for a loyalty cost,
    // so `!isLoyalty` is belt-and-braces — and worth keeping, because the note
    // below is the right one for a planeswalker either way.
    if (ability.payable && !ability.isLoyalty) {
      add(
        abilityNoteLabel(ability.costText),
        'the app charges that cost and then nothing happens — apply the effect yourself with the manual tools',
      );
      continue;
    }

    const what = ability.isLoyalty ? 'Its loyalty abilities' : abilityNoteLabel(ability.costText);
    add(what, ability.isLoyalty
      ? 'use the counters tool and apply the effect yourself'
      : 'pay that cost with the manual tools, then apply the effect at the table');
  }

  for (const raw of card.keywords) {
    if (canonicalKeyword(raw) !== null) continue;
    const how = NAMED[raw.trim().toLowerCase()];
    if (how) add(raw, how);
  }

  return notes;
}

/**
 * A single summary line, or null when the app handles the card completely.
 *
 * ⚠️ Capped at three named items plus a count. A card with nine unautomated
 * keywords is a card whose own text you have to read anyway, and a nine-item
 * list on a hover panel pushes the oracle text off the screen.
 */
export function tier3SummaryFor(card: CardData, faceIndex = 0): string | null {
  const notes = tier3NotesFor(card, faceIndex);
  if (notes.length === 0) return null;
  const named = notes.slice(0, 3).map((n) => n.what);
  const rest = notes.length - named.length;
  const list = named.join(', ') + (rest > 0 ? `, and ${rest} more` : '');
  return `Not automatic: ${list}.`;
}
