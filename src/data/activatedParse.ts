// Activated abilities — `cost: effect`, parsed once at ingest.
//
// ⚠️ THE HONEST BOUNDARY, and it is the whole design: an ability is offered only
// when the engine can CHARGE its cost. Mana and {T}/{Q} it can charge. `Sacrifice
// this creature` (424 lines), `Pay 2 life` (294), `Discard a card` (227) are
// decisions rather than prices — exactly the distinction D68 drew for ward, where
// `ward—Pay N life` became a tax and `ward—Sacrifice a creature` stayed Tier 3
// because "pay two life" and "sacrifice a creature" are not the same promise and
// half-enforcing the second is worse than not enforcing it. Same rule here.
// Measured: 16,299 ability lines carry a cost the engine cannot pay. They stay
// manual and `tier3.ts` names them on the card.
//
// ⚠️ `isManaAbility` is ASKED OF `parseManaProduction`, matched by line index,
// never re-guessed. A mana ability leaking into `ActivateAbility` would put
// `{T}: Add {G}` on the stack — which CR 605 says never happens — and a real
// ability misclassified as mana would vanish from the action list entirely.
// `tier3.ts` learned this the hard way with Command Tower: a second heuristic
// beside the first is how a disclosure starts lying.
//
// Excluded by construction, which is a feature: `Equip {2}`, `Crew 8`,
// `Cycling {2}` and `Level up {1}` have NO COLON, so the line splitter never
// classifies them as activated and they stay Tier 3 exactly as `tier3.ts`
// already claims.

import type { ActivatedAbility, ActivationCondition, ManaProduction } from '../engine/types/oracle';
import type { ManaCost } from '../engine/types/mana';
import type { Warn } from './oracleParse';
import { parseTargetClauses, splitAbilityLines } from './targetParse';
import { conditionOf, isAskedCondition, predicatesOf, type PermanentPredicate } from './replacementParse';

const NOOP_WARN: Warn = () => undefined;

/** A loyalty cost: `+1`, `−3`, `-X`, `0`. Planeswalkers only. */
const LOYALTY_RE = /^[+−-]?(?:\d+|X)$/;

/** `Pay 3 life`. Same shape `parseWardLife` reads, and deliberately so. */
const LIFE_RE = /\bpay\s+(\d+)\s+life\b/i;

const SORCERY_ONLY_RE = /\bactivate\s+(?:this\s+ability\s+)?only\s+as\s+a\s+sorcery\b/i;
/** D328 - CR 602.5b. Read the way `SORCERY_ONLY_RE` is; enforced by `TurnState.activations`. */
const ONCE_PER_TURN_RE = /\bactivate\s+(?:this\s+ability\s+)?only\s+once\s+each\s+turn\b/i;

/**
 * D342 - "Activate only <condition>." - the whole tail, its clauses joined by
 * "and only" ("as a sorcery and only once each turn", "during your upkeep and
 * only if you control a Swamp"). Every clause is read: the two limits the engine
 * charged before (once each turn, as a sorcery), "as an instant" (no restriction
 * at all), and the `ActivationCondition` vocabulary. A clause outside it is the
 * `unread` string, which the caller records as an UNPAID cost: the ability is
 * then never offered and never claimed with its restriction silently dropped.
 * ⚠️ Anchored at both ends per clause (D90): a clause with a word left over is a
 * clause this module has not read.
 */
const ACTIVATE_ONLY_RE = /\bactivate\s+(?:this\s+ability\s+)?only\s+(.+?)\.(?:\s*\([^)]*\))?\s*$/i;
const AC_NUM = '(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d+)';
const AC_NUM_WORDS: Readonly<Record<string, number>> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const AC_CARD_TYPES: Readonly<Record<string, string>> = {
  artifact: 'Artifact', creature: 'Creature', enchantment: 'Enchantment', land: 'Land',
  planeswalker: 'Planeswalker', instant: 'Instant', sorcery: 'Sorcery',
};
function acNumber(raw: string | undefined): number | null {
  const key = (raw ?? '').toLowerCase();
  if (key in AC_NUM_WORDS) return AC_NUM_WORDS[key] ?? null;
  return /^\d+$/.test(key) ? Number(key) : null;
}
/**
 * "black permanents" -> "black permanent", "Swamps" -> "Swamp"; "Plains" is its own
 * plural (D180). An irregular plural (Elves, Allies) is refused rather than guessed -
 * a subtype nobody has would make the condition never hold.
 */
function acSingular(noun: string): string | null {
  const words = noun.trim().split(/\s+/);
  const last = words[words.length - 1] ?? '';
  if (last === 'Plains') return words.join(' ');
  if (/(?:ies|ves|ss)$/.test(last) || !/s$/.test(last)) return null;
  words[words.length - 1] = last.slice(0, -1);
  return words.join(' ');
}

/**
 * "black permanent" / "permanent" / "a snow permanent": "permanent" names no card
 * type, so the predicate is the adjectives before it - or the EMPTY predicate, every
 * permanent, when there are none (D168's reading of "Sacrifice a permanent").
 */
function acPredicates(singular: string): readonly PermanentPredicate[] | null {
  const m = /^(.*?)\s*permanent$/i.exec(singular.trim().replace(/^(?:a|an)\s+/i, ''));
  if (!m) return predicatesOf(singular);
  const rest = (m[1] ?? '').trim();
  if (rest === '') return [{ supertypes: [], types: [], subtypes: [], colors: [] }];
  return predicatesOf(rest);
}

export interface ActivationRead {
  readonly conditions: readonly ActivationCondition[];
  readonly sorceryOnly: boolean;
  readonly oncePerTurn: boolean;
  /** The first clause the vocabulary could not read, or null. */
  readonly unread: string | null;
}

export function parseActivationConditions(text: string, selfName?: string): ActivationRead {
  const m = ACTIVATE_ONLY_RE.exec(text);
  if (!m) return { conditions: [], sorceryOnly: false, oncePerTurn: false, unread: null };
  const conditions: ActivationCondition[] = [];
  let sorceryOnly = false;
  let oncePerTurn = false;
  let unread: string | null = null;
  const self = selfName ? '|' + selfName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const selfPower = new RegExp(`^if (?:this (?:creature|permanent)${self})'s power is ${AC_NUM} or greater$`, 'i');
  const selfCreature = new RegExp(`^if (?:this (?:creature|permanent|artifact|enchantment|land|Vehicle)${self}) is a creature$`, 'i');
  const controlCount = new RegExp(`^if you control ${AC_NUM} or more (.+)$`, 'i');
  const handAtMost = new RegExp(`^if you have ${AC_NUM} or fewer cards? in hand$`, 'i');
  const handExactly = new RegExp(`^if you have exactly ${AC_NUM} cards? in hand$`, 'i');
  const handAtLeast = new RegExp(`^if you have ${AC_NUM} or more cards? in hand$`, 'i');
  const graveyardCards = new RegExp(`^if there are ${AC_NUM} or more ([a-z]+) cards in your graveyard$`, 'i');
  const graveyardAny = new RegExp(`^if there are ${AC_NUM} or more cards in your graveyard$`, 'i');
  for (const raw of (m[1] ?? '').split(/\s+and\s+only\s+/i)) {
    const c = raw.trim();
    let mm: RegExpExecArray | null;
    if (/^once each turn$/i.test(c)) oncePerTurn = true;
    else if (/^as a sorcery$/i.test(c)) sorceryOnly = true;
    else if (/^as an instant$/i.test(c)) {
      // No restriction at all: the ability may be activated whenever its controller has priority.
    } else if ((mm = /^during your turn(, before attackers are declared)?$/i.exec(c))) {
      conditions.push({ kind: 'duringYourTurn' });
      if (mm[1]) conditions.push({ kind: 'beforeAttackersDeclared' });
    } else if (/^before attackers are declared$/i.test(c)) conditions.push({ kind: 'beforeAttackersDeclared' });
    else if (/^(?:during an opponent's turn|if it's not your turn)$/i.test(c)) conditions.push({ kind: 'duringOpponentsTurn' });
    else if (/^during your upkeep$/i.test(c)) conditions.push({ kind: 'duringStep', step: 'upkeep', whose: 'yours' });
    else if (/^during any upkeep step$/i.test(c)) conditions.push({ kind: 'duringStep', step: 'upkeep', whose: 'any' });
    else if (/^during (?:the )?declare blockers step$/i.test(c)) conditions.push({ kind: 'duringStep', step: 'declareBlockers', whose: 'any' });
    else if (/^during (?:the )?declare attackers step$/i.test(c)) conditions.push({ kind: 'duringStep', step: 'declareAttackers', whose: 'any' });
    else if (/^during combat$/i.test(c)) conditions.push({ kind: 'duringCombat' });
    else if ((mm = controlCount.exec(c))) {
      const count = acNumber(mm[1]);
      const singular = acSingular(mm[2] ?? '');
      const any = singular === null ? null : acPredicates(singular);
      if (count === null || any === null) unread = unread ?? c;
      else conditions.push({ kind: 'controlCount', count, any });
    } else if ((mm = /^if (you control .+)$/i.exec(c))) {
      const cond = conditionOf(mm[1] ?? '');
      // "you control a black permanent": the board grammar has no word for a permanent; the empty predicate does.
      const perm = cond === null ? /^you control ((?:a|an) .+?permanent)$/i.exec(mm[1] ?? '') : null;
      const permAny = perm ? acPredicates(perm[1] ?? '') : null;
      if (permAny !== null) conditions.push({ kind: 'board', condition: { kind: 'controlPermanent', any: permAny } });
      else if (cond === null || isAskedCondition(cond)) unread = unread ?? c;
      else conditions.push({ kind: 'board', condition: cond });
    } else if ((mm = selfPower.exec(c))) {
      const power = acNumber(mm[1]);
      if (power === null) unread = unread ?? c;
      else conditions.push({ kind: 'selfPowerAtLeast', power });
    } else if (/^if you have no cards in hand$/i.test(c)) conditions.push({ kind: 'handSize', cmp: 'atMost', count: 0 });
    else if ((mm = handAtMost.exec(c)) || (mm = handExactly.exec(c)) || (mm = handAtLeast.exec(c))) {
      const count = acNumber(mm[1]);
      const cmp = handAtMost.test(c) ? 'atMost' : handExactly.test(c) ? 'exactly' : 'atLeast';
      if (count === null) unread = unread ?? c;
      else conditions.push({ kind: 'handSize', cmp, count });
    } else if ((mm = graveyardAny.exec(c))) {
      // Threshold's own wording: any card counts.
      const count = acNumber(mm[1]);
      if (count === null) unread = unread ?? c;
      else conditions.push({ kind: 'graveyardCards', count, types: [] });
    } else if ((mm = graveyardCards.exec(c))) {
      const count = acNumber(mm[1]);
      const type = AC_CARD_TYPES[(mm[2] ?? '').toLowerCase()];
      if (count === null || type === undefined) unread = unread ?? c;
      else conditions.push({ kind: 'graveyardCards', count, types: [type] });
    } else if (selfCreature.test(c)) conditions.push({ kind: 'selfIsCreature' });
    else unread = unread ?? c;
  }
  return { conditions, sorceryOnly, oncePerTurn, unread };
}

/**
 * D328 - "Sacrifice a token" / "a creature token" / "another creature or
 * token": the word the sacrifice chooser reads off the INSTANCE (`isToken`),
 * beside whatever predicate the words before it make - per alternative,
 * split on "or" the way `predicatesOf` splits. Only the sacrifice cost
 * reads the word; `predicateOf` itself still refuses it, so no other
 * reader widens.
 */
function tokenPredicates(phrase: string): readonly PermanentPredicate[] | null {
  const out: PermanentPredicate[] = [];
  for (const alt of phrase.split(/\bor\b/).map((p) => p.trim()).filter((p) => p !== '')) {
    const tok = /^(?:(?:a|an|another)\s+)?(?:(.+)\s+)?tokens?$/i.exec(alt);
    const base: readonly PermanentPredicate[] | null = tok
      ? tok[1] === undefined
        ? [{ supertypes: [], types: [], subtypes: [], colors: [] }]
        : predicatesOf(tok[1].trim())
      : predicatesOf(alt);
    if (base === null) return null;
    out.push(...(tok ? base.map((p) => ({ ...p, token: true })) : base));
  }
  return out.length === 0 ? null : out;
}

/**
 * Split a cost string on commas that separate cost components, not commas
 * inside a symbol. `{1}, {T}, Sacrifice a creature` → three parts.
 */
/**
 * D342 - an ABILITY WORD (CR 207.2c) has no rules meaning: "Threshold — {1}{G}:
 * Regenerate this creature. Activate only if there are seven or more cards in
 * your graveyard." prints its whole rule after the word, so the word is stripped
 * before the cost parts are read. ⚠️ A closed list, deliberately: Boast, Exhaust,
 * Channel and their kin are KEYWORDS printed in the same shape whose rule is NOT
 * printed (Boast: attacked this turn and once each turn), and stripping those
 * would charge the cost and drop the rule. `costText` keeps the printed word.
 */
const ABILITY_WORD_RE = /^(?:Threshold|Hellbent|Metalcraft|Delirium|Ferocious|Formidable|Domain|Morbid|Fateful hour|Chroma|Radiance|Landfall|Constellation|Inspired|Heroic|Battalion|Raid|Revolt|Spell mastery|Adamant|Alliance|Coven|Pack tactics|Enrage|Converge|Magecraft|Addendum|Corrupted|Celebration|Valiant|Paradox|Survival|Flurry|Eerie|Undergrowth|Kinship|Lieutenant|Parley|Sweep|Grandeur|Strive|Cohort|Eminence|Fathomless descent|Max speed|Council's dilemma|Will of the council|Tempting offer|Join forces|Descend \d+) — /;

function costParts(costText: string): string[] {
  return costText
    .replace(ABILITY_WORD_RE, '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

/** Is this whole part payable in mana symbols alone? */
const MANA_ONLY_RE = /^(?:\{[^}]+\}\s*)+$/;
/**
 * D305 - "Equip {N}" and nothing else on the line (reminder text aside). A typed
 * equip ("Equip Knight {1}"), a non-mana equip cost ("Equip-Sacrifice a
 * creature") and Reconfigure stay where they were: Tier 3, by name.
 */
const EQUIP_RE = /^Equip ((?:\{[^}]+\})+)$/;
const EQUIP_EFFECT = 'Attach this Equipment to target creature you control.';
/**
 * D306 - "Cycling {N}" and nothing else on the line (reminder text aside). The
 * typed landcyclings ("Basic landcycling {2}", "Forestcycling {1}") search a
 * library and stay where they were - Tier 3, by name - until a search prompt
 * carries them.
 */
const CYCLING_RE = /^Cycling ((?:\{[^}]+\})+)$/;
const CYCLING_EFFECT = 'Draw a card.';
// D311 - THE CREW SEAM: "Crew N" on its own line (reminder text aside).
const CREW_RE = /^Crew (\d+)$/;
const CREW_EFFECT = 'This Vehicle becomes an artifact creature until end of turn.';

export interface ActivatedParseInput {
  readonly oracleText: string;
  readonly isPermanent: boolean;
  /** From `parseManaProduction` on the SAME face, so mana abilities are known. */
  readonly producesMana: readonly ManaProduction[];
  /** From `parseManaCost`, applied to the mana part of each cost. */
  readonly parseCost: (raw: string, warn?: Warn) => ManaCost | null;
  /** D320 - the face's short name, which an older printing uses where a newer one says "this creature". */
  readonly selfName?: string;
}

/**
 * Every activated ability on a face, in printed order.
 *
 * Returns `[]` for the common case — a vanilla creature, a basic land — which is
 * what keeps this cheap across a 113,559-card ingest.
 */
/** "a" / "an" / "one" … "five" → the number of cards or permanents a cost names. */
const COUNT_WORDS: Readonly<Record<string, number>> = {
  a: 1, an: 1, another: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
};

/**
 * A plural predicate noun back to the singular `predicateOf` reads: "Clerics"
 * → "Cleric", "creatures" → "creature", "Elves" → "Elf". ⚠️ Only the LAST word
 * is touched and only when the count is plural; a noun the table and the
 * trailing-s rule both miss reaches `predicatesOf` unchanged and is refused
 * there, never widened.
 */
const PLURAL_NOUNS: Readonly<Record<string, string>> = {
  elves: 'Elf', dwarves: 'Dwarf', wolves: 'Wolf', allies: 'Ally', zombies: 'Zombie',
  faeries: 'Faerie', mercenaries: 'Mercenary', foxes: 'Fox', sphinxes: 'Sphinx',
  merfolk: 'Merfolk', kavu: 'Kavu', elk: 'Elk', mice: 'Mouse', werewolves: 'Werewolf',
};
function singularNoun(phrase: string, plural: boolean): string {
  if (!plural) return phrase;
  const words = phrase.trim().split(/\s+/);
  const last = words[words.length - 1] ?? '';
  const lower = last.toLowerCase();
  const single = PLURAL_NOUNS[lower] ?? (lower.endsWith('s') ? last.slice(0, -1) : last);
  words[words.length - 1] = single;
  return words.join(' ');
}

export function parseActivatedAbilities(
  input: ActivatedParseInput,
  warn: Warn = NOOP_WARN,
): ActivatedAbility[] {
  const { oracleText, isPermanent, producesMana, parseCost, selfName } = input;
  if (!oracleText) return [];

  // ⚠️ Asked, not guessed. A null `line` is an intrinsic land-type ability, which
  // has no printed line and so can never collide with one.
  const manaLines = new Set<number>();
  for (const p of producesMana) {
    if (p.line !== null) manaLines.add(p.line);
  }

  const out: ActivatedAbility[] = [];
  for (const line of splitAbilityLines(oracleText, isPermanent)) {
    // ⚠️ D305 - THE EQUIPMENT SEAM. "Equip {N}" prints no colon, so the splitter
    // files it as static; it IS an activated ability (CR 702.6a) whose cost the
    // engine can charge. Synthesized HERE, in print order, so `#a<index>` counts
    // it exactly where the card prints it and no other ability's ref moves.
    // ⚠️ Asked of the reminder-stripped text WHATEVER the splitter said: the
    // reminder "({3}: Attach to target creature you control. ...)" carries a
    // colon, so the splitter files the printed line as an activated ability
    // with the cost "Equip {3} ({3}" - and that reading must never win.
    const printed = line.text.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const equip = EQUIP_RE.exec(printed);
    if (equip) {
      const equipCost = parseCost(equip[1] ?? '', warn);
      out.push({
        index: out.length,
        costText: equip[1] ?? '',
        effectText: EQUIP_EFFECT,
        manaCost: equipCost,
        requiresTap: false,
        requiresUntap: false,
        lifeCost: 0,
        lifeCostCommanderColors: false,
        sacrificesSelf: false,
        sacrificeCost: null,
        discardCost: null,
        exileFromGraveyardCost: null,
        exileSelfFromGraveyard: false,
        activatesFromGraveyard: false,
        removeCounterCost: null,
        tapCost: null,
        unpaidCosts: equipCost === null ? [equip[1] ?? ''] : [],
        payable: equipCost !== null,
        isManaAbility: false,
        isLoyalty: false,
        sorceryOnly: true,
        oncePerTurn: false,
        activateOnly: [],
        targets: parseTargetClauses(EQUIP_EFFECT, warn),
        equip: { line: printed },
      });
      continue;
    }
    // ⚠️ D306 - THE CYCLING SEAM. "Cycling {N}" is an activated ability from
    // the HAND (CR 702.29a) whose cost - the mana and the discard of the card
    // itself - the engine charges; synthesized in print order like Equip, from
    // the reminder-stripped text (the reminder "({2}, Discard this card: Draw a
    // card.)" carries a colon too).
    const cycling = CYCLING_RE.exec(printed);
    if (cycling) {
      const cyclingCost = parseCost(cycling[1] ?? '', warn);
      out.push({
        index: out.length,
        costText: cycling[1] ?? '',
        effectText: CYCLING_EFFECT,
        manaCost: cyclingCost,
        requiresTap: false,
        requiresUntap: false,
        lifeCost: 0,
        lifeCostCommanderColors: false,
        sacrificesSelf: false,
        sacrificeCost: null,
        discardCost: null,
        exileFromGraveyardCost: null,
        exileSelfFromGraveyard: false,
        activatesFromGraveyard: false,
        removeCounterCost: null,
        tapCost: null,
        unpaidCosts: cyclingCost === null ? [cycling[1] ?? ''] : [],
        payable: cyclingCost !== null,
        isManaAbility: false,
        isLoyalty: false,
        sorceryOnly: false,
        oncePerTurn: false,
        activateOnly: [],
        targets: [],
        cycling: { line: printed },
      });
      continue;
    }
    // D311 - THE CREW SEAM: "Crew N" is an activated ability with no mana in
    // its cost - tap any number of untapped creatures you control with total
    // power N or more (CR 702.122a) - and the engine's own effect: the Vehicle
    // is an artifact creature until end of turn. Instant speed, no targets.
    const crewLine = CREW_RE.exec(printed);
    if (crewLine) {
      const power = Number(crewLine[1] ?? '0');
      const crewAny = predicatesOf('creature');
      out.push({
        index: out.length,
        costText: `Crew ${power}`,
        effectText: CREW_EFFECT,
        manaCost: parseCost('{0}', warn),
        requiresTap: false,
        requiresUntap: false,
        lifeCost: 0,
        lifeCostCommanderColors: false,
        sacrificesSelf: false,
        sacrificeCost: null,
        discardCost: null,
        exileFromGraveyardCost: null,
        exileSelfFromGraveyard: false,
        activatesFromGraveyard: false,
        removeCounterCost: null,
        tapCost: crewAny === null ? null : { count: 0, another: true, any: crewAny, powerAtLeast: power },
        unpaidCosts: crewAny === null ? [`Crew ${power}`] : [],
        payable: crewAny !== null,
        isManaAbility: false,
        isLoyalty: false,
        sorceryOnly: false,
        oncePerTurn: false,
        activateOnly: [],
        targets: [],
        crew: { line: printed, power },
      });
      continue;
    }
    if (line.kind !== 'activated') continue;

    const parts = costParts(line.costText);
    const manaSymbols: string[] = [];
    const unpaidCosts: string[] = [];
    let requiresTap = false;
    let requiresUntap = false;
    let lifeCost = 0;
    let lifeCostCommanderColors = false;
    let sacrificesSelf = false;
    let sacrificeCost: ActivatedAbility['sacrificeCost'] = null;
    let discardCost: ActivatedAbility['discardCost'] = null;
    let tapCost: ActivatedAbility['tapCost'] = null;
    let exileFromGraveyardCost: ActivatedAbility['exileFromGraveyardCost'] = null;
    let exileSelfFromGraveyard = false;
    let removeCounterCost: ActivatedAbility['removeCounterCost'] = null;
    let isLoyalty = false;

    for (const part of parts) {
      if (part === '{T}') {
        requiresTap = true;
        continue;
      }
      if (part === '{Q}') {
        requiresUntap = true;
        continue;
      }
      if (LOYALTY_RE.test(part)) {
        isLoyalty = true;
        continue;
      }
      if (MANA_ONLY_RE.test(part)) {
        manaSymbols.push(part);
        continue;
      }
      const life = part.match(LIFE_RE);
      if (life && /^pay\s+\d+\s+life$/i.test(part.trim())) {
        lifeCost += Number(life[1] ?? 0);
        continue;
      }
      // ⚠️ WAR ROOM'S EXACT PHRASE AND ONLY THAT PHRASE (D90, D159). The number
      // is board-dependent, so the parse records the RULE and the activation
      // computes it from the player's identity. Any other "pay life equal to…"
      // wording stays unpaid — a computed cost the engine cannot compute is a
      // cost it cannot charge.
      if (/^pay life equal to the number of colors in your commanders' color identity$/i.test(part.trim())) {
        lifeCostCommanderColors = true;
        continue;
      }
      // ⚠️ SELF-sacrifice only — "Sacrifice this artifact/creature/land/…" is
      // deterministic (no chooser), so it is a PRICE the engine can take
      // (D159). "Sacrifice a creature" is a decision and stays unpaid, exactly
      // the ward distinction D68 drew. ⚠️ Chargeable is not offerable — see
      // `ActivatedAbility.sacrificesSelf` and `legal.ts`'s def gate.
      // D321 - "Sacrifice this creature" on a newer printing, "Sacrifice Spectacular
      // Spider-Man" on an older one: the same deterministic price.
      const sacSelfAlt = selfName ? '|' + selfName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
      // D329 - "Exile this card from your graveyard" (CR 113.6): the ability is
      // activated from the graveyard, the card exiled as its cost - the same
      // deterministic price on an older printing that names the card.
      if (new RegExp('^exile (?:this card' + sacSelfAlt + ') from your graveyard$', 'i').test(part.trim())) {
        exileSelfFromGraveyard = true;
        continue;
      }
      // D329 - "Exile N <predicate> cards from your graveyard": a chooser over
      // the graveyard, priced by letting the activation name the cards
      // (`ActivateAbility.exileFromGraveyard`) - the discard chooser's shape.
      // D334 - "another creature card" / "two other cards": the card itself is not a candidate.
      const exg = /^exile (a|an|one|two|three|four|another) (?:(other) )?(.+) from your graveyard$/i.exec(part.trim());
      if (exg && exileFromGraveyardCost === null) {
        const word = (exg[1] ?? '').toLowerCase();
        const count = word === 'another' ? 1 : (COUNT_WORDS[word] ?? 0);
        const another = word === 'another' || exg[2] !== undefined;
        const rest = (exg[3] ?? '').trim();
        if (count > 0 && /^cards?$/i.test(rest)) {
          exileFromGraveyardCost = { count, any: null, another };
          continue;
        }
        const stripped = rest.replace(/\s+cards?$/i, '');
        if (count > 0 && stripped !== rest) {
          const any = predicatesOf(singularNoun(stripped, count > 1));
          if (any !== null) {
            exileFromGraveyardCost = { count, any, another };
            continue;
          }
        }
      }
      if (new RegExp('^sacrifice (?:this [a-z]+' + sacSelfAlt + ')$', 'i').test(part.trim())) {
        sacrificesSelf = true;
        continue;
      }
      // ⚠️ The CHOOSER half (D168): "Sacrifice a creature" / "another
      // creature or artifact" / "a Food" — a decision, priced by letting the
      // ACTIVATION name the permanent (`ActivateAbility.sacrifice`).
      // Anchored both ends; a phrase `predicatesOf` cannot read stays in
      // `unpaidCosts`, so "Sacrifice a creature with power 4" is refused
      // rather than widened. "a permanent" is the empty predicate — every
      // `.every` over empty arrays holds, which is exactly what the word
      // means. Chargeable is not offerable: the def gate in `legal.ts` and
      // `handlers.ts` still refuses an undef'd ability (D159's rule).
      const sac = /^sacrifice (a|an|another) (.+)$/i.exec(part.trim());
      if (sac && sacrificeCost === null) {
        const another = (sac[1] ?? '').toLowerCase() === 'another';
        const rest = (sac[2] ?? '').trim();
        // D328 - "a token" / "a creature token" / "another creature or token" (`tokenPredicates`).
        const any =
          /^permanents?$/i.test(rest)
            ? [{ supertypes: [], types: [], subtypes: [], colors: [] }]
            : /\btokens?$/i.test(rest)
              ? tokenPredicates(rest)
              : predicatesOf(rest);
        if (any !== null) {
          sacrificeCost = { another, any };
          continue;
        }
      }
      // ⚠️ The DISCARD chooser (D286): "Discard a card" / "Discard two cards"
      // / "Discard a land card" — a decision, priced by letting the activation
      // name the cards (`ActivateAbility.discard`). "a card" is ANY card
      // (`any: null`); a typed card goes through `predicatesOf` with the word
      // "card(s)" stripped, and a phrase it cannot place ("a nonland card",
      // "two nonland cards with the same name") stays in `unpaidCosts`.
      const disc = /^discard (a|an|one|two|three|four) (.+)$/i.exec(part.trim());
      if (disc && discardCost === null) {
        const count = COUNT_WORDS[(disc[1] ?? '').toLowerCase()] ?? 0;
        const rest = (disc[2] ?? '').trim();
        if (count > 0 && /^cards?$/i.test(rest)) {
          discardCost = { count, any: null, atRandom: false };
          continue;
        }
        // D328 - "Discard a card at random": no choice to price; the engine
        // draws the cards off the seeded rng when the cost is paid.
        if (count > 0 && /^cards? at random$/i.test(rest)) {
          discardCost = { count, any: null, atRandom: true };
          continue;
        }
        const stripped = rest.replace(/\s+cards?$/i, '');
        if (count > 0 && stripped !== rest) {
          const any = predicatesOf(singularNoun(stripped, count > 1));
          if (any !== null) {
            discardCost = { count, any, atRandom: false };
            continue;
          }
        }
      }
      // ⚠️ The TAP chooser (D286): "Tap an untapped creature you control" /
      // "Tap two untapped Wizards you control" / "Tap another untapped
      // creature you control" — the activation names the permanents
      // (`ActivateAbility.tap`). Anchored both ends; the plural noun is
      // read back to the singular before `predicatesOf`.
      const tapm = /^tap (a|an|another|one|two|three|four|five) untapped (.+) you control$/i.exec(part.trim());
      if (tapm && tapCost === null) {
        const word = (tapm[1] ?? '').toLowerCase();
        const count = COUNT_WORDS[word] ?? 0;
        const any = count > 0 ? predicatesOf(singularNoun((tapm[2] ?? '').trim(), count > 1)) : null;
        if (any !== null) {
          tapCost = { count, another: word === 'another', any };
          continue;
        }
      }
      // ⚠️ The REMOVE-A-COUNTER cost (D319): "Remove a +1/+1 counter from this
      // creature" / "Remove two charge counters from this artifact" - SELF only
      // and a fixed count, so it is deterministic (no chooser): a PRICE the
      // engine can take, offered only while the permanent carries the counters.
      // "from a creature you control" is a decision and stays unpaid; "X" stays
      // unpaid (a computed cost the engine cannot compute). Chargeable is not
      // offerable: the def gate in `legal.ts` and `handlers.ts` still refuses an
      // undef'd ability (D159's rule).
      // D320 - "from this creature" on a newer printing, "from Brigone" on an older one.
      const selfAlt = selfName ? '|' + selfName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
      const rc = new RegExp('^remove (a|an|one|two|three|four|five) ([^ ]+) counters? from (?:this [a-z]+' + selfAlt + ')$', 'i').exec(part.trim());
      if (rc && removeCounterCost === null) {
        const count = COUNT_WORDS[(rc[1] ?? '').toLowerCase()] ?? 0;
        const kind = rc[2] ?? '';
        if (count > 0 && kind !== '') {
          removeCounterCost = { kind, count };
          continue;
        }
      }
      unpaidCosts.push(part);
    }

    const raw = manaSymbols.join('');
    const manaCost = raw === '' ? null : parseCost(raw, warn);
    const isManaAbility = manaLines.has(line.index);

    // D342 - "Activate only <condition>": the conditions the vocabulary reads ride
    // the ability; one it cannot read is an UNPAID cost, so the ability is never
    // offered or claimed with its restriction silently dropped.
    const activation = parseActivationConditions(line.text, selfName);
    if (activation.unread !== null) unpaidCosts.push('activate only ' + activation.unread);

    if (isLoyalty) warn('activated:loyalty');
    else if (unpaidCosts.length > 0) warn('activated:nonManaCost');

    // ⚠️ A life cost IS payable — `parseWardLife` set that precedent in M5 and
    // the payment problem already carries a life component. But loyalty is not,
    // because it needs once-per-turn tracking and a counter cost that do not
    // exist, and an ability whose cost we cannot charge is not offered at all.
    const payable = unpaidCosts.length === 0 && !isLoyalty;

    out.push({
      index: out.length,
      costText: line.costText,
      effectText: line.effectText,
      manaCost,
      requiresTap,
      requiresUntap,
      lifeCost,
      lifeCostCommanderColors,
      sacrificesSelf,
      sacrificeCost,
      discardCost,
      tapCost,
      removeCounterCost,
      exileFromGraveyardCost,
      exileSelfFromGraveyard,
      // D333 - the effect names the zone the ability is activated from.
      activatesFromGraveyard: new RegExp('^return (?:this card' + (selfName ? '|' + selfName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '') + ') from your graveyard to (?:the battlefield|your hand)', 'i').test(line.effectText),
      unpaidCosts,
      payable,
      isManaAbility,
      isLoyalty,
      // D342 - the compound tails ("as a sorcery and only once each turn") read by the clause parser too.
      sorceryOnly: SORCERY_ONLY_RE.test(line.text) || activation.sorceryOnly,
      oncePerTurn: ONCE_PER_TURN_RE.test(line.text) || activation.oncePerTurn,
      activateOnly: activation.conditions,
      // The same clause parser the spell path uses — one grammar, not two.
      // Measured: 6,082 ability lines contain a target clause.
      targets: parseTargetClauses(line.effectText, warn),
    });
  }

  return out;
}
