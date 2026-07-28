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

export interface Tier3Note {
  /** Short label, e.g. "Crew". */
  readonly what: string;
  /** What the player does instead. Active voice, from their side. */
  readonly how: string;
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

  if (allSpecs.some((s) => s.kinds.length === 0)) {
    add('Its targets', 'aim at anything — the app cannot read this card’s targeting rule, so it does not check it');
  }
  const unenforced = [...new Set(allSpecs.flatMap((s) => s.unenforced))].filter((u) => u !== '');
  if (unenforced.length > 0) {
    add(`“${unenforced.slice(0, 2).join('”, “')}” on its target`, 'check it yourself — only the KIND of object is checked');
  }
  for (const ability of abilities) {
    if (ability.isManaAbility || ability.payable) continue;
    const what = ability.isLoyalty ? 'Its loyalty abilities' : `Its “${ability.costText}” ability`;
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
