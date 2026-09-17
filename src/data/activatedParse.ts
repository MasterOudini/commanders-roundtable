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

import type { ActivatedAbility, ActivationCondition, ManaProduction, TurnMemoryQuestion } from '../engine/types/oracle';
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
/** D490 - a basic land type by name (`a Plains`, the Legates' boards), else the noun reader's predicates. */
function acLandOrPredicates(noun: string): readonly PermanentPredicate[] | null {
  const word = noun.trim();
  if (/^(?:Plains|Island|Swamp|Mountain|Forest)$/.test(word)) return [{ supertypes: [], types: [], subtypes: [word], colors: [] }];
  return acPredicates(word);
}

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

/**
 * D348 - the printed clauses that ask what THIS TURN did. Every one is anchored at
 * both ends, as the rest of this vocabulary is, and a wording outside the list stays
 * unread rather than half-read.
 */
// D398 - the set widened for the conditions a trigger's intervening if, an entering
// replacement and a static print (the same closed reader serves "Activate only if"):
// amounts, attacks, exits from the battlefield, damage to a player, the source's own
// entry, descend. Every wording is still anchored at both ends.
const TM_NUM = '(?:two|three|four|five|six|seven|eight|nine|ten|\\d+)';
const TURN_MEMORY_RE = new RegExp(
  '^if (?:' +
    [
      '(?:an opponent|you) (?:lost|gained) life this turn',
      `you gained ${TM_NUM} or more life this turn`,
      'an opponent was dealt (?:combat )?damage this turn',
      "you've cast (?:a noncreature|an instant or sorcery|a creature|another|two or more|three or more|four or more) spells? this turn",
      '(?:a|another) creature died this turn',
      `${TM_NUM} or more creatures died this turn`,
      "you've discarded a card this turn",
      'you created a token this turn',
      'an artifact entered under your control this turn',
      'you had a creature enter the battlefield under your control this turn',
      'a (?:land|creature|artifact) entered the battlefield under your control this turn',
      `${TM_NUM} or more nonland permanents entered the battlefield under your control this turn`,
      '(?:this (?:land|creature|permanent)|it) entered this turn',
      'a card left your graveyard this turn',
      'you attacked this turn',
      `you attacked with ${TM_NUM} or more creatures this turn`,
      'a permanent (?:left the battlefield under your control|you controlled left the battlefield) this turn',
      'a nonland permanent left the battlefield this turn',
      `you've drawn ${TM_NUM} or more cards this turn`,
      'you descended this turn',
    ].join('|') +
    ')$',
  'i',
);

const P_CREATURE = [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }];
const P_ARTIFACT = [{ supertypes: [], types: ['Artifact'], subtypes: [], colors: [] }];
const P_LAND = [{ supertypes: [], types: ['Land'], subtypes: [], colors: [] }];
/** D398 - "a permanent card": any one of the permanent types (CR 110.4). */
const P_PERMANENT = ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle'].map((t) => ({ supertypes: [], types: [t], subtypes: [], colors: [] }));
const P_INSTANT_SORCERY = [
  { supertypes: [], types: ['Instant'], subtypes: [], colors: [] },
  { supertypes: [], types: ['Sorcery'], subtypes: [], colors: [] },
];

/** The condition one of those clauses means, or null when the wording is outside the list. */
function turnMemoryCondition(mm: RegExpExecArray): ActivationCondition | null {
  const c = (mm[0] ?? "").toLowerCase();
  const of = (
    what: TurnMemoryQuestion,
    who: "you" | "opponent" | "any",
    count: number,
    any: readonly PermanentPredicate[] | null = null,
    none: readonly PermanentPredicate[] | null = null,
    flags: { readonly self?: true; readonly excludeSelf?: true } = {},
  ): ActivationCondition => ({ kind: "turnMemory", what, who, count, any, none, ...flags });
  const num = (re: RegExp): number => acNumber(re.exec(c)?.[1]) ?? 0;
  if (/an opponent lost life this turn/.test(c)) return of("lostLife", "opponent", 1);
  if (/you lost life this turn/.test(c)) return of("lostLife", "you", 1);
  if (/you gained life this turn/.test(c)) return of("gainedLife", "you", 1);
  if (/an opponent gained life this turn/.test(c)) return of("gainedLife", "opponent", 1);
  // D398 - the amounts, damage, attacks, exits, the source's own entry, descend.
  if (/you gained (\w+) or more life this turn/.test(c)) return of("lifeGained", "you", num(/you gained (\w+) or more life/));
  if (/an opponent was dealt (?:combat )?damage this turn/.test(c)) return of("damaged", "opponent", 1);
  if (/cast a noncreature spell this turn/.test(c)) return of("cast", "you", 1, null, P_CREATURE);
  if (/cast an instant or sorcery spell this turn/.test(c)) return of("cast", "you", 1, P_INSTANT_SORCERY);
  if (/cast a creature spell this turn/.test(c)) return of("cast", "you", 1, P_CREATURE);
  if (/cast another spell this turn/.test(c)) return of("cast", "you", 1, null, null, { excludeSelf: true });
  if (/cast (\w+) or more spells this turn/.test(c)) return of("cast", "you", num(/cast (\w+) or more spells/));
  if (/another creature died this turn/.test(c)) return of("died", "any", 1, P_CREATURE, null, { excludeSelf: true });
  if (/a creature died this turn/.test(c)) return of("died", "any", 1, P_CREATURE);
  if (/(\w+) or more creatures died this turn/.test(c)) return of("died", "any", num(/(\w+) or more creatures died/), P_CREATURE);
  if (/you've discarded a card this turn/.test(c)) return of("discarded", "you", 1);
  if (/you created a token this turn/.test(c)) return of("tokensCreated", "you", 1);
  if (/an artifact entered under your control this turn/.test(c)) return of("entered", "you", 1, P_ARTIFACT);
  if (/you had a creature enter the battlefield under your control this turn/.test(c)) return of("entered", "you", 1, P_CREATURE);
  if (/a land entered the battlefield under your control this turn/.test(c)) return of("entered", "you", 1, P_LAND);
  if (/a creature entered the battlefield under your control this turn/.test(c)) return of("entered", "you", 1, P_CREATURE);
  if (/an artifact entered the battlefield under your control this turn/.test(c)) return of("entered", "you", 1, P_ARTIFACT);
  if (/(\w+) or more nonland permanents entered the battlefield under your control this turn/.test(c)) return of("entered", "you", num(/(\w+) or more nonland/), null, P_LAND);
  if (/(?:this (?:land|creature|permanent)|it) entered this turn/.test(c)) return of("entered", "you", 1, null, null, { self: true });
  if (/a card left your graveyard this turn/.test(c)) return of("leftGraveyard", "you", 1);
  if (/you attacked with (\w+) or more creatures this turn/.test(c)) return of("attackers", "you", num(/you attacked with (\w+) or more/));
  if (/you attacked this turn/.test(c)) return of("attackers", "you", 1);
  if (/a permanent (?:left the battlefield under your control|you controlled left the battlefield) this turn/.test(c)) return of("left", "you", 1);
  if (/a nonland permanent left the battlefield this turn/.test(c)) return of("left", "any", 1, null, P_LAND);
  if (/you've drawn (\w+) or more cards this turn/.test(c)) return of("drawn", "you", num(/drawn (\w+) or more/));
  if (/you descended this turn/.test(c)) return of("toGraveyard", "you", 1, P_PERMANENT);
  return null;
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
    // D348 - THE TURN RECORD conditions: what this turn has already done. The predicates
    // ride the condition and the CHECK derives them, since the record holds ids.
    else if ((mm = TURN_MEMORY_RE.exec(c))) {
      const read = turnMemoryCondition(mm);
      if (read === null) unread = unread ?? c;
      else conditions.push(read);
    }
    // D490 - the free-cast conditions: a commander among your permanents; a land type (or any noun the reader knows)
    // on some opponent's board and another on yours - the Legate cycle's two boards.
    else if (/^if you control a commander$/i.test(c)) conditions.push({ kind: 'controlsCommander' });
    else if ((mm = /^if an opponent controls (?:a|an) (.+?) and you control (?:a|an) (.+)$/i.exec(c))) {
      const theirs = acLandOrPredicates(mm[1] ?? '');
      const yours = acLandOrPredicates(mm[2] ?? '');
      if (theirs === null || yours === null) unread = unread ?? c;
      else conditions.push({ kind: 'acrossControl', theirs, yours });
    }
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
 * D363 - the counter kinds the engine can REPRESENT (`CounterKind`, D130). A cost
 * naming any other counter is refused: the engine has never put a charge or a time
 * counter on anything, so removing one is a price it could not take honestly.
 */
const ENGINE_COUNTER_KINDS: ReadonlySet<string> = new Set(['+1/+1', '-1/-1']);

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
const ABILITY_WORD_RE = /^(?:Bloodrush|Channel|Threshold|Hellbent|Metalcraft|Delirium|Ferocious|Formidable|Domain|Morbid|Fateful hour|Chroma|Radiance|Landfall|Constellation|Inspired|Heroic|Battalion|Raid|Revolt|Spell mastery|Adamant|Alliance|Coven|Pack tactics|Enrage|Converge|Magecraft|Addendum|Corrupted|Celebration|Valiant|Paradox|Survival|Flurry|Eerie|Undergrowth|Kinship|Lieutenant|Parley|Sweep|Grandeur|Strive|Cohort|Eminence|Fathomless descent|Max speed|Council's dilemma|Will of the council|Tempting offer|Join forces|Descend \d+) — /;

/** D457 - the exhaust word before the cost (CR 702.178): read into `ActivatedAbility.exhaust`, never stripped silently. */
const EXHAUST_RE = /^Exhaust — /;
/** D458 - the boast word before the cost (CR 702.142): read into `ActivatedAbility.boast` + `oncePerTurn`. */
const BOAST_RE = /^Boast — /;
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
/**
 * D410 - TYPECYCLING (CR 702.29b): `Forestcycling {2}`, `Basic landcycling {1}`, `Slivercycling {3}` -
 * cycling's cost from the hand, the effect a SEARCH for a card of the type instead of the draw (the
 * vocabulary's search, revealed, to the hand, then shuffle); two printed on one line
 * (`Forestcycling {2}, plainscycling {2}`) are two abilities. `null` when the line is not cycling at all.
 */
const CYCLING_PIECE = /^(?:(Cycling)|([A-Za-z]+(?: land)?)cycling) ((?:\{[^}]+\})+)$/;
export function cyclingAbilities(printed: string): readonly { readonly cost: string; readonly effect: string; readonly type: string | null }[] | null {
  const out: { cost: string; effect: string; type: string | null }[] = [];
  for (const piece of printed.split(', ')) {
    const m = CYCLING_PIECE.exec(piece);
    if (!m) return null;
    const cost = m[3] ?? '';
    if (m[1] !== undefined) {
      out.push({ cost, effect: CYCLING_EFFECT, type: null });
      continue;
    }
    const word = m[2] ?? '';
    // `Basic land` and `Artifact land` search by supertype and type, `Land` by type, the rest by subtype.
    const label = /^basic land$/i.test(word) ? 'basic land' : /^artifact land$/i.test(word) ? 'artifact land' : /^land$/i.test(word) ? 'land' : word.charAt(0).toUpperCase() + word.slice(1);
    out.push({ cost, effect: `Search your library for ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label} card, reveal it, put it into your hand, then shuffle.`, type: label });
  }
  return out.length > 0 ? out : null;
}
// D311 - THE CREW SEAM: "Crew N" on its own line (reminder text aside).
const CREW_RE = /^Crew (\d+)$/;
// D440 - scavenge (CR 702.96a): the mana price on the printed line; the rest of the ability is the rule's own words.
const SCAVENGE_RE = /^Scavenge ((?:\{[^}]+\})+)$/;
const SCAVENGE_EFFECT = "Put a number of +1/+1 counters equal to this card's power on target creature.";
// D448 - unearth (CR 702.84a): the mana price on the printed line; the rest of the ability is the rule's own words.
const UNEARTH_RE = /^Unearth ((?:\{[^}]+\})+)$/;
const UNEARTH_EFFECT = 'Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield.';
// D451 - reinforce (CR 702.77a): the number and the mana price on the printed line; the rest is the rule's own words.
const REINFORCE_RE = /^Reinforce (\d+)—((?:\{[^}]+\})+)$/;
/** D462 - the ninjutsu line (CR 702.49a); `Commander ninjutsu` is not this word and stays Tier 3. */
const NINJUTSU_RE = /^Ninjutsu ((?:\{[^}]+\})+)$/;
const NINJUTSU_EFFECT = 'Put this card onto the battlefield from your hand tapped and attacking.';
const NINJUTSU_RETURN = { count: 1, another: false, any: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [], unblockedAttacker: true }] } as const;
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
  /** D440 - the face's printed power, for scavenge's counters (null or `*` refuses the synthesis). */
  readonly basePower?: number | null;
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
  const { oracleText, isPermanent, producesMana, parseCost, selfName, basePower } = input;
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
        returnCost: null,
        returnsSelf: false,
        putCounterCost: null,
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
    // D410 - and TYPECYCLING (CR 702.29b): the same cost, a search for the type instead of the draw; two
    // on one line are two abilities, each claiming the line.
    const cyclings = CYCLING_RE.test(printed) ? null : cyclingAbilities(printed);
    const cycling = CYCLING_RE.exec(printed);
    if (cycling || cyclings) {
      const pieces = cyclings ?? [{ cost: cycling?.[1] ?? '', effect: CYCLING_EFFECT, type: null }];
      for (const piece of pieces) {
      const cyclingCost = parseCost(piece.cost, warn);
      out.push({
        index: out.length,
        costText: piece.cost,
        effectText: piece.effect,
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
        returnCost: null,
        returnsSelf: false,
        putCounterCost: null,
        unpaidCosts: cyclingCost === null ? [piece.cost] : [],
        payable: cyclingCost !== null,
        isManaAbility: false,
        isLoyalty: false,
        sorceryOnly: false,
        oncePerTurn: false,
        activateOnly: [],
        targets: piece.type === null ? [] : parseTargetClauses(piece.effect, warn),
        cycling: piece.type === null ? { line: printed } : { line: printed, type: piece.type },
      });
      }
      continue;
    }
    // D311 - THE CREW SEAM: "Crew N" is an activated ability with no mana in
    // its cost - tap any number of untapped creatures you control with total
    // power N or more (CR 702.122a) - and the engine's own effect: the Vehicle
    // is an artifact creature until end of turn. Instant speed, no targets.
    // D440 - THE SCAVENGE SEAM: an activated ability from the graveyard whose cost the engine charges (the mana, and
    // the card's own exile - D329's price) and whose counters resolve natively off the printed power; a `*` power
    // or an unreadable price leaves the line unsynthesized.
    const scav = SCAVENGE_RE.exec(printed);
    if (scav) {
      const scavCost = parseCost(scav[1] ?? '', warn);
      const power = basePower ?? null;
      if (scavCost !== null && power !== null && power > 0) {
        out.push({
          index: out.length,
          costText: `${scav[1]}, Exile this card from your graveyard`,
          effectText: SCAVENGE_EFFECT,
          manaCost: scavCost,
          requiresTap: false,
          requiresUntap: false,
          lifeCost: 0,
          lifeCostCommanderColors: false,
          sacrificesSelf: false,
          sacrificeCost: null,
          discardCost: null,
          exileFromGraveyardCost: null,
          exileSelfFromGraveyard: true,
          activatesFromGraveyard: false,
          removeCounterCost: null,
          tapCost: null,
          returnCost: null,
          returnsSelf: false,
          putCounterCost: null,
          unpaidCosts: [],
          payable: true,
          isManaAbility: false,
          isLoyalty: false,
          sorceryOnly: true,
          oncePerTurn: false,
          activateOnly: [],
          targets: parseTargetClauses(SCAVENGE_EFFECT, warn),
          scavenge: { line: printed, power },
        });
        continue;
      }
    }
    // D448 - THE UNEARTH SEAM: an activated ability from the graveyard (CR 702.84a) whose cost is the printed mana
    // and whose effect the engine runs natively - the card returns unearthed (haste, exile on leaving, exile at
    // the next end step). Sorcery speed is the rule's; an unreadable price leaves the line unsynthesized.
    const unearth = UNEARTH_RE.exec(printed);
    if (unearth) {
      const unearthCost = parseCost(unearth[1] ?? '', warn);
      if (unearthCost !== null) {
        out.push({
          index: out.length,
          costText: unearth[1] ?? '',
          effectText: UNEARTH_EFFECT,
          manaCost: unearthCost,
          requiresTap: false,
          requiresUntap: false,
          lifeCost: 0,
          lifeCostCommanderColors: false,
          sacrificesSelf: false,
          sacrificeCost: null,
          discardCost: null,
          exileFromGraveyardCost: null,
          exileSelfFromGraveyard: false,
          activatesFromGraveyard: true,
          removeCounterCost: null,
          tapCost: null,
          returnCost: null,
          returnsSelf: false,
          putCounterCost: null,
          unpaidCosts: [],
          payable: true,
          isManaAbility: false,
          isLoyalty: false,
          sorceryOnly: true,
          oncePerTurn: false,
          activateOnly: [],
          targets: [],
          unearth: { line: printed },
        });
        continue;
      }
    }
    // D462 - THE NINJUTSU SEAM: an activated ability from the hand (CR 702.49a) whose cost is the printed mana and
    // the return of an unblocked attacker you control (D352's chooser, one predicate more), and whose effect the
    // engine runs natively - the card enters tapped and attacking. An unreadable price leaves the line unsynthesized.
    const ninjutsu = NINJUTSU_RE.exec(printed);
    if (ninjutsu) {
      const ninjutsuCost = parseCost(ninjutsu[1] ?? '', warn);
      if (ninjutsuCost !== null) {
        out.push({
          index: out.length,
          costText: (ninjutsu[1] ?? '') + ", Return an unblocked attacker you control to its owner's hand",
          effectText: NINJUTSU_EFFECT,
          manaCost: ninjutsuCost,
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
          returnCost: NINJUTSU_RETURN,
          returnsSelf: false,
          putCounterCost: null,
          unpaidCosts: [],
          payable: true,
          isManaAbility: false,
          isLoyalty: false,
          sorceryOnly: false,
          oncePerTurn: false,
          activateOnly: [],
          targets: [],
          ninjutsu: { line: printed },
        });
        continue;
      }
    }
    // D451 - THE REINFORCE SEAM: an activated ability from the hand (CR 702.77a) whose cost is the printed mana
    // and the card's own discard, and whose counters resolve natively off the printed number; an unreadable
    // price leaves the line unsynthesized.
    const reinforce = REINFORCE_RE.exec(printed);
    if (reinforce) {
      const reinforceCost = parseCost(reinforce[2] ?? '', warn);
      const rn = Number(reinforce[1] ?? '0');
      if (reinforceCost !== null && rn > 0) {
        const reinforceEffect = `Put ${rn === 1 ? 'a' : rn === 2 ? 'two' : rn === 3 ? 'three' : String(rn)} +1/+1 counter${rn === 1 ? '' : 's'} on target creature.`;
        out.push({
          index: out.length,
          costText: `${reinforce[2]}, Discard this card`,
          effectText: reinforceEffect,
          manaCost: reinforceCost,
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
          discardsSelf: true,
          removeCounterCost: null,
          tapCost: null,
          returnCost: null,
          returnsSelf: false,
          putCounterCost: null,
          unpaidCosts: [],
          payable: true,
          isManaAbility: false,
          isLoyalty: false,
          sorceryOnly: false,
          oncePerTurn: false,
          activateOnly: [],
          targets: parseTargetClauses(reinforceEffect, warn),
          reinforce: { line: printed, n: rn },
        });
        continue;
      }
    }
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
        returnCost: null,
        returnsSelf: false,
        putCounterCost: null,
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

    // D457 - the exhaust word is the ability's own rule (once per object), read off the cost text and charged behind.
    const exhaust = EXHAUST_RE.test(line.costText);
    // D458 - and the boast word the same way (attacked this turn, once each turn - the rules ride the flags).
    const boast = BOAST_RE.test(line.costText);
    const parts = costParts(exhaust ? line.costText.replace(EXHAUST_RE, '') : boast ? line.costText.replace(BOAST_RE, '') : line.costText);
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
    let discardsSelf = false;
    let removeCounterCost: ActivatedAbility['removeCounterCost'] = null;
    let returnCost: ActivatedAbility['returnCost'] = null;
    let returnsSelf = false;
    let putCounterCost: ActivatedAbility['putCounterCost'] = null;
    let isLoyalty = false;
    // D472 - the loyalty cost as a signed number (`+2`, `−3`, `0`); `X` forms stay unpaid.
    let loyaltyCost: number | undefined;

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
        const num = part.replace('−', '-');
        if (/^[+-]?\d+$/.test(num)) loyaltyCost = Number(num);
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
      // D451 - "Discard this card" (CR 113.6): the ability is activated from the hand, the card discarded as
      // its cost - a deterministic price (bloodrush; an older printing names the card).
      if (new RegExp('^discard (?:this card' + sacSelfAlt + ')$', 'i').test(part.trim())) {
        discardsSelf = true;
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
      // D353 - AND IT COUNTS. "Sacrifice two lands" / "Sacrifice three Treasures" is the
      // same decision N times over, which is what the discard and tap choosers have said
      // since D286; the plural noun is read back to the singular before `predicatesOf`, so
      // the predicate grammar stays in one place. A COMPOUND ("two lands and this artifact")
      // is two prices in one phrase and reaches `unpaidCosts` unchanged.
      // D334's shape: the exclusion is a WORD between the count and the noun, so it needs its
      // own group - "other creatures" reaching `predicatesOf` whole is a refusal, not a predicate.
      const sac = /^sacrifice (a|an|another|one|two|three|four) (?:(other) )?(.+)$/i.exec(part.trim());
      if (sac && sacrificeCost === null) {
        const word = (sac[1] ?? '').toLowerCase();
        const another = word === 'another' || sac[2] !== undefined;
        const count = word === 'another' ? 1 : (COUNT_WORDS[word] ?? 0);
        const rest0 = (sac[3] ?? '').trim();
        const rest = count > 1 ? singularNoun(rest0, true) : rest0;
        // D328 - "a token" / "a creature token" / "another creature or token" (`tokenPredicates`).
        const any =
          /^permanents?$/i.test(rest)
            ? [{ supertypes: [], types: [], subtypes: [], colors: [] }]
            : /\btokens?$/i.test(rest)
              ? tokenPredicates(rest)
              : predicatesOf(rest);
        if (any !== null && count > 0) {
          sacrificeCost = { count, another, any };
          continue;
        }
      }
      // D353 - THE SELF COUNTER: "Put a -1/-1 counter on this creature" - the
      // remove-a-counter cost's mirror (D319), SELF only and a fixed count, so a price the
      // engine takes. "on a creature you control" is a decision and stays unpaid.
      const pcm = new RegExp('^put (a|an|one|two|three|four|five) ([^ ]+) counters? on (?:this [a-z]+' + sacSelfAlt + ')$', 'i').exec(part.trim());
      if (pcm && putCounterCost === null) {
        const count = COUNT_WORDS[(pcm[1] ?? '').toLowerCase()] ?? 0;
        const kind = pcm[2] ?? '';
        if (count > 0 && kind !== '') {
          putCounterCost = { kind, count };
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
      // D352 - THE SELF RETURN: "Return this enchantment to its owner's hand" - the
      // permanent that owns the ability goes to hand, deterministic, no chooser: the
      // self-sacrifice's price one zone over. Its effect then resolves off a source in
      // HAND, exactly as the self-sacrifice's resolves off one in the graveyard.
      if (new RegExp("^return (?:this [a-z]+" + sacSelfAlt + ") to its owner's hand$", 'i').test(part.trim())) {
        returnsSelf = true;
        continue;
      }
      // D352 - THE RETURN CHOOSER: "Return a land you control to its owner's hand" /
      // "Return three lands you control to their owner's hand" - the activation names
      // the permanents (`ActivateAbility.returnToHand`), the tap chooser's shape. Anchored
      // both ends; a plural noun is read back to the singular before `predicatesOf`, and a
      // phrase it cannot place stays in `unpaidCosts` rather than being widened.
      const retm = /^return (a|an|another|one|two|three|four|five) (.+) you control to (?:its|their) owner's hand$/i.exec(part.trim());
      if (retm && returnCost === null) {
        const word = (retm[1] ?? '').toLowerCase();
        const count = COUNT_WORDS[word] ?? 0;
        const any = count > 0 ? predicatesOf(singularNoun((retm[2] ?? '').trim(), count > 1)) : null;
        if (any !== null) {
          returnCost = { count, another: word === 'another', any };
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
          removeCounterCost = { kind, count, from: null };
          continue;
        }
      }
      // D447 - "Remove a counter from this creature" / "Remove two counters from this creature": no kind
      // named, SELF only. Deterministic all the same - +1/+1 and -1/-1 annihilate in pairs (CR 704.5q), so
      // the permanent carries one kind whenever the ability can be activated, and `kind: null` says "the
      // kind it carries". The chooser form ("from a creature you control") still needs a kind to pick by.
      const rca = new RegExp('^remove (a|an|one|two|three|four|five) counters? from (?:this [a-z]+' + selfAlt + ')$', 'i').exec(part.trim());
      if (rca && removeCounterCost === null) {
        const count = COUNT_WORDS[(rca[1] ?? '').toLowerCase()] ?? 0;
        if (count > 0) {
          removeCounterCost = { kind: null, count, from: null };
          continue;
        }
      }
      // D363 - THE CHOOSER HALF: "Remove a +1/+1 counter from a creature you
      // control" / "Remove two +1/+1 counters from among creatures you control".
      // ⚠️ Anchored at both ends and read through `predicatesOf`, the same grammar
      // the sacrifice chooser uses, so a phrase it cannot place stays unpaid rather
      // than being widened - "from a nonland permanent you control" is refused for
      // the same reason Magmaw's sacrifice is.
      // ⚠️ The KIND must be one the engine can REPRESENT: "Remove a counter" (any
      // kind) and "a charge counter" are refused, because `CounterKind` is +1/+1 and
      // -1/-1 (D130) and a counter the engine never puts is one it cannot remove.
      const rcc = /^remove (a|an|one|two|three|four|five) ([^ ]+) counters? from (?:among )?(.+) you control$/i.exec(part.trim());
      if (rcc && removeCounterCost === null) {
        const count = COUNT_WORDS[(rcc[1] ?? '').toLowerCase()] ?? 0;
        const kind = rcc[2] ?? '';
        const rest0 = (rcc[3] ?? '').trim();
        const rest = count > 1 ? singularNoun(rest0, true) : rest0;
        const from = /^permanents?$/i.test(rest) ? [{ supertypes: [], types: [], subtypes: [], colors: [] }] : predicatesOf(rest);
        if (count > 0 && ENGINE_COUNTER_KINDS.has(kind) && from !== null) {
          removeCounterCost = { kind, count, from };
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
    // the payment problem already carries a life component. D472 - and so is a NUMERIC loyalty
    // cost now (CR 606): the counters are the price, charged in the cost batch, once a turn per
    // permanent at sorcery speed (`legal.ts` / `handlers.ts`). An X loyalty cost stays unpaid.
    const payable = unpaidCosts.length === 0 && (!isLoyalty || loyaltyCost !== undefined);

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
      returnCost,
      returnsSelf,
      putCounterCost,
      removeCounterCost,
      exileFromGraveyardCost,
      exileSelfFromGraveyard,
      ...(discardsSelf ? { discardsSelf: true as const } : {}),
      // D333 - the effect names the zone the ability is activated from.
      activatesFromGraveyard: new RegExp('^return (?:this card' + (selfName ? '|' + selfName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '') + ') from your graveyard to (?:the battlefield|your hand)', 'i').test(line.effectText),
      unpaidCosts,
      payable,
      isManaAbility,
      isLoyalty,
      ...(loyaltyCost !== undefined ? { loyaltyCost } : {}),
      // D342 - the compound tails ("as a sorcery and only once each turn") read by the clause parser too.
      // D472 - CR 606.3: a loyalty ability is activated only at sorcery speed.
      sorceryOnly: SORCERY_ONLY_RE.test(line.text) || activation.sorceryOnly || isLoyalty,
      oncePerTurn: ONCE_PER_TURN_RE.test(line.text) || activation.oncePerTurn || boast,
      ...(exhaust ? { exhaust: true as const } : {}),
      ...(boast ? { boast: true as const } : {}),
      activateOnly: activation.conditions,
      // The same clause parser the spell path uses — one grammar, not two.
      // Measured: 6,082 ability lines contain a target clause.
      targets: parseTargetClauses(line.effectText, warn),
    });
  }

  return out;
}

/**
 * D406 - THE ADDITIONAL COST AT CAST (CR 601.2b, 602.2b's cousin): `As an additional cost to cast
 * this spell, <cost>.` is the SAME cost grammar an activated line prints left of its colon -
 * `Sacrifice a creature`, `Discard a card`, `Pay 3 life`, `Tap two untapped creatures you control`,
 * `Exile a creature card from your graveyard`, `Return a land you control to its owner's hand` - so
 * it is read by the same parser, through a synthetic line whose effect is a dummy. What the cast
 * charges is what that grammar reads as PAYABLE with no mana and no tap of the source (a spell is not
 * on the battlefield): a chooser verb or a life payment. `<cost> or pay {M}` (Eaten Alive) is the
 * verb with the mana as its alternative; a random discard, a counter cost, a self cost and any
 * phrase the grammar cannot place leave the line unread (D90).
 */
export interface AdditionalCost {
  /** The printed line, reminder text stripped, for the accounting's claim. */
  readonly line: string;
  /** The cost text the grammar read (`sacrifice a creature`). */
  readonly costText: string;
  readonly lifeCost: number;
  readonly sacrificeCost: ActivatedAbility['sacrificeCost'];
  readonly discardCost: ActivatedAbility['discardCost'];
  readonly tapCost: ActivatedAbility['tapCost'];
  readonly exileFromGraveyardCost: ActivatedAbility['exileFromGraveyardCost'];
  readonly returnCost: ActivatedAbility['returnCost'];
  /** `... or pay {M}`: the mana the caster may pay INSTEAD of the verb. */
  readonly orPay: ManaCost | null;
}

/** D406 / D415 - ONE chooser verb or a life payment, read by the activation grammar: the additional cost's price and the payment prompt's verb price share it. */
export interface CostVerbPrice {
  /** The cost text the grammar read (`sacrifice a creature`). */
  readonly costText: string;
  readonly lifeCost: number;
  readonly sacrificeCost: ActivatedAbility['sacrificeCost'];
  readonly discardCost: ActivatedAbility['discardCost'];
  readonly tapCost: ActivatedAbility['tapCost'];
  readonly exileFromGraveyardCost: ActivatedAbility['exileFromGraveyardCost'];
  readonly returnCost: ActivatedAbility['returnCost'];
}

/**
 * D415 - the cost grammar over ONE price: exactly one chooser verb (a sacrifice, a discard, a tap, an exile
 * from the graveyard, a return to hand) or a life payment; two verbs joined by `or`, a comma or an `and`,
 * a self cost, a random discard, a tap with a power floor and a counter cost stay unread (D406's refusals).
 */
export function readCostVerbs(costText: string, parseCost: (raw: string, warn?: Warn) => ManaCost | null, selfName?: string): CostVerbPrice | null {
  if (/\b(?:or|and)\b/.test(costText.replace(/\b(?:artifact|creature|land|permanent|enchantment|planeswalker) (?:or|and) /g, 'X ')) || costText.includes(',')) return null;
  const capital = costText.charAt(0).toUpperCase() + costText.slice(1);
  const parsed = parseActivatedAbilities({ oracleText: `${capital}: Draw a card.`, isPermanent: true, producesMana: [], parseCost, ...(selfName ? { selfName } : {}) });
  const a = parsed[0];
  if (!a || parsed.length !== 1 || !a.payable) return null;
  if (a.manaCost !== null || a.requiresTap || a.requiresUntap || a.sacrificesSelf || a.returnsSelf || a.exileSelfFromGraveyard || a.isLoyalty) return null;
  if (a.putCounterCost !== null || a.removeCounterCost !== null || a.lifeCostCommanderColors) return null;
  if (a.discardCost?.atRandom) return null;
  const verbs = [a.sacrificeCost, a.discardCost, a.tapCost, a.exileFromGraveyardCost, a.returnCost].filter((x) => x !== null).length;
  if (verbs + (a.lifeCost > 0 ? 1 : 0) !== 1) return null;
  // A tap cost with a power floor is crew's shape, not a cast cost.
  if (a.tapCost && a.tapCost.powerAtLeast !== undefined) return null;
  return { costText, lifeCost: a.lifeCost, sacrificeCost: a.sacrificeCost, discardCost: a.discardCost, tapCost: a.tapCost, exileFromGraveyardCost: a.exileFromGraveyardCost, returnCost: a.returnCost };
}

export const ADDITIONAL_COST_LINE = /^As an additional cost to cast this spell, (.+)\.$/;

export function parseAdditionalCost(oracleText: string, parseCost: (raw: string, warn?: Warn) => ManaCost | null, selfName?: string): AdditionalCost | null {
  for (const raw of (oracleText ?? '').split('\n')) {
    const line = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const m = ADDITIONAL_COST_LINE.exec(line);
    if (!m) continue;
    let costText = (m[1] ?? '').trim();
    let orPay: ManaCost | null = null;
    // `<verb> or pay {M}` / `pay {M} or <verb>`: the verb, with the mana as its alternative.
    const tail = /^(.+?) or pay ((?:\{[^}]+\})+)$/.exec(costText);
    const head = /^pay ((?:\{[^}]+\})+) or (.+)$/.exec(costText);
    if (tail) { costText = (tail[1] ?? '').trim(); orPay = parseCost(tail[2] ?? ''); if (!orPay) return null; }
    else if (head) { costText = (head[2] ?? '').trim(); orPay = parseCost(head[1] ?? ''); if (!orPay) return null; }
    const verbs = readCostVerbs(costText, parseCost, selfName);
    if (!verbs) return null;
    return { line, ...verbs, orPay };
  }
  return null;
}

/**
 * D408 - THE ALTERNATIVE COST AT CAST (CR 118.9): `You may <cost> rather than pay this spell's mana
 * cost.` - the mana cost REPLACED by what the sentence names, read by the same cost grammar as the
 * additional cost (D406): a mana payment (`pay {M}`), a life payment, one chooser verb (a sacrifice, a
 * discard, a tap, an exile from the graveyard, a return to hand), or the pitch (`exile a blue card
 * from your hand`), joined by `and`; a leading condition the activation grammar reads (`If you
 * control a Plains`, `If it's not your turn`, the turn record's questions) gates the election.
 * Anything else - a life gain for others, a reveal, a permission - leaves the line unread (D90).
 */
export interface AlternativeCost {
  readonly line: string;
  readonly costText: string;
  readonly mana: ManaCost | null;
  readonly lifeCost: number;
  readonly sacrificeCost: ActivatedAbility['sacrificeCost'];
  readonly discardCost: ActivatedAbility['discardCost'];
  readonly tapCost: ActivatedAbility['tapCost'];
  readonly exileFromGraveyardCost: ActivatedAbility['exileFromGraveyardCost'];
  readonly returnCost: ActivatedAbility['returnCost'];
  /** `exile a blue card from your hand`: so many hand cards of one of these colours (any colour when empty). */
  readonly exileFromHand: { readonly count: number; readonly colors: readonly string[] } | null;
  /** The conditions the election needs, in the activation grammar's terms (empty: none). */
  readonly conditions: readonly ActivationCondition[];
  /**
   * D449 - the KEYWORD this alternative cost is (CR 702.74 evoke, CR 702.109 dash): the cast that elects it
   * marks the permanent (`CardInstance.evoked` / `dashed`) and the engine runs the rider. Absent for a
   * printed `rather than pay` line.
   */
  readonly keyword?: 'evoke' | 'dash';
  /**
   * D490 - `If <condition>, you may cast this spell without paying its mana cost.`: an alternative cost of NOTHING
   * under its conditions (mana null, no verb, no pitch). The offer and the handler already price a null mana at
   * nothing and ask the conditions; the fuzz counts the casts by this flag.
   */
  readonly free?: true;
}

export const ALTERNATIVE_COST_LINE = /rather than pay (?:this spell's|its) mana cost\.$/;
/** D490 - the conditional free cast's line, kept out of the effect text as the alternative-cost line is. */
export const FREE_CAST_LINE = /you may cast this spell without paying its mana cost\.$/i;

export function parseAlternativeCost(oracleText: string, parseCost: (raw: string, warn?: Warn) => ManaCost | null, selfName?: string): AlternativeCost | null {
  for (const raw of (oracleText ?? '').split('\n')) {
    const line = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    // D449 - THE KEYWORD ALTERNATIVE COSTS: `Evoke {cost}` and `Dash {cost}` on their own line (reminder text
    // aside) are "you may pay {cost} rather than pay this spell's mana cost" with a rider the engine runs off
    // the mark the cast leaves. One alternative cost per face: a printed line found first wins.
    const kwAlt = /^(Evoke|Dash) ((?:\{[^}]+\})+)$/.exec(line);
    if (kwAlt) {
      const kwMana = parseCost(kwAlt[2] ?? '');
      if (kwMana === null) return null;
      return {
        line,
        costText: kwAlt[2] ?? '',
        mana: kwMana,
        lifeCost: 0,
        sacrificeCost: null,
        discardCost: null,
        tapCost: null,
        exileFromGraveyardCost: null,
        returnCost: null,
        exileFromHand: null,
        conditions: [],
        keyword: kwAlt[1] === 'Evoke' ? 'evoke' : 'dash',
      };
    }
    // D490 - THE CONDITIONAL FREE CAST: `If <condition>, you may cast this spell without paying its mana cost.` - an
    // alternative cost of nothing under the activation grammar's conditions (the Legates' two boards, `you control a
    // commander`). The bare form with no condition has no printing and is refused; a condition the grammar cannot
    // read refuses the line (D90).
    const free = /^(?:(If [^,]+), )?(?:you|You) may cast this spell without paying its mana cost\.$/.exec(line.replace(/^[A-Z][a-z]+ [\u2014-] /, ''));
    if (free) {
      if (free[1] === undefined) return null;
      const read = parseActivationConditions(`Activate only ${free[1].charAt(0).toLowerCase() + free[1].slice(1)}.`, selfName);
      if (read.unread !== null || read.sorceryOnly || read.oncePerTurn || read.conditions.length === 0) return null;
      return {
        line,
        costText: 'cast it without paying its mana cost',
        mana: null,
        lifeCost: 0,
        sacrificeCost: null,
        discardCost: null,
        tapCost: null,
        exileFromGraveyardCost: null,
        returnCost: null,
        exileFromHand: null,
        conditions: read.conditions,
        free: true,
      };
    }
    if (!ALTERNATIVE_COST_LINE.test(line)) continue;
    // An ability word (`Raid — `) is print; a condition leads with `If ...,`.
    const body = line.replace(/^[A-Z][a-z]+ [\u2014-] /, '');
    const m = /^(?:(If [^,]+), )?(?:you|You) may (.+?) rather than pay (?:this spell's|its) mana cost\.$/.exec(body);
    if (!m) return null;
    const conditions: ActivationCondition[] = [];
    if (m[1] !== undefined) {
      const read = parseActivationConditions(`Activate only ${m[1].charAt(0).toLowerCase() + m[1].slice(1)}.`, selfName);
      if (read.unread !== null || read.sorceryOnly || read.oncePerTurn || read.conditions.length === 0) return null;
      conditions.push(...read.conditions);
    }
    const costText = (m[2] ?? '').trim();
    let mana: ManaCost | null = null;
    let lifeCost = 0;
    let exileFromHand: AlternativeCost['exileFromHand'] = null;
    let sacrificeCost: ActivatedAbility['sacrificeCost'] = null;
    let discardCost: ActivatedAbility['discardCost'] = null;
    let tapCost: ActivatedAbility['tapCost'] = null;
    let exileFromGraveyardCost: ActivatedAbility['exileFromGraveyardCost'] = null;
    let returnCost: ActivatedAbility['returnCost'] = null;
    let verbs = 0;
    for (const piece0 of costText.split(/ and (?=pay |exile |sacrifice |discard |tap |return )/)) {
      const piece = piece0.trim();
      let mm: RegExpExecArray | null;
      if ((mm = /^pay ((?:\{[^}]+\})+)$/.exec(piece))) {
        if (mana !== null) return null;
        mana = parseCost(mm[1] ?? '');
        if (mana === null) return null;
        continue;
      }
      if ((mm = /^pay (\d+) life$/.exec(piece))) { lifeCost += Number(mm[1]); continue; }
      if ((mm = /^exile (a|an|two|three|\d+) (?:(white|blue|black|red|green) )?cards? from your hand$/.exec(piece))) {
        if (exileFromHand !== null) return null;
        const n = mm[1] === 'a' || mm[1] === 'an' ? 1 : mm[1] === 'two' ? 2 : mm[1] === 'three' ? 3 : Number(mm[1]);
        const c = mm[2] ? [{ white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' }[mm[2]] as string] : [];
        exileFromHand = { count: n, colors: c };
        verbs++;
        continue;
      }
      const capital = piece.charAt(0).toUpperCase() + piece.slice(1);
      const parsed = parseActivatedAbilities({ oracleText: `${capital}: Draw a card.`, isPermanent: true, producesMana: [], parseCost, ...(selfName ? { selfName } : {}) });
      const a = parsed[0];
      if (!a || parsed.length !== 1 || !a.payable || a.manaCost !== null || a.requiresTap || a.requiresUntap || a.sacrificesSelf || a.returnsSelf || a.exileSelfFromGraveyard || a.isLoyalty) return null;
      if (a.putCounterCost !== null || a.removeCounterCost !== null || a.lifeCost > 0 || a.discardCost?.atRandom || (a.tapCost && a.tapCost.powerAtLeast !== undefined)) return null;
      if (a.sacrificeCost) sacrificeCost = a.sacrificeCost;
      else if (a.discardCost) discardCost = a.discardCost;
      else if (a.tapCost) tapCost = a.tapCost;
      else if (a.exileFromGraveyardCost) exileFromGraveyardCost = a.exileFromGraveyardCost;
      else if (a.returnCost) returnCost = a.returnCost;
      else return null;
      verbs++;
    }
    // At most one chooser verb (the picks ride one set of fields); something must be paid.
    if (verbs > 1 || (verbs === 0 && mana === null && lifeCost === 0)) return null;
    return { line, costText, mana, lifeCost, sacrificeCost, discardCost, tapCost, exileFromGraveyardCost, returnCost, exileFromHand, conditions };
  }
  return null;
}
