// Scryfall's `keywords[]` → our Tier-2 keyword union.
//
// ⚠️ Scryfall's array is the source, NOT the oracle text. Wizards' own keyword
// tagging is complete and stable across rewordings, whereas a regex over oracle
// text finds "flying" inside "Whenever a creature with flying attacks…" and
// grants it to the wrong card. The one place we do read text is landwalk and
// protection, because Scryfall lists those as bare `"Landwalk"` /
// `"Protection"` without saying *which* — and the which is the entire rule.

import type { Keyword } from './types/oracle';

/** Scryfall spelling → ours. Absent means "not a Tier-2 keyword". */
const CANON: Readonly<Record<string, Keyword>> = {
  flying: 'flying',
  reach: 'reach',
  trample: 'trample',
  vigilance: 'vigilance',
  haste: 'haste',
  lifelink: 'lifelink',
  deathtouch: 'deathtouch',
  'first strike': 'firstStrike',
  'double strike': 'doubleStrike',
  menace: 'menace',
  defender: 'defender',
  indestructible: 'indestructible',
  flash: 'flash',
  fear: 'fear',
  intimidate: 'intimidate',
  skulk: 'skulk',
  shadow: 'shadow',
  horsemanship: 'horsemanship',
  hexproof: 'hexproof',
  shroud: 'shroud',
  // ⚠️ M5 (D68). All three change what combat damage DOES rather than who may be
  // blocked by whom, which is why they land here rather than in COMBAT_KEYWORDS
  // below — that set is the derive cache's "only matters on the battlefield"
  // filter, and these matter at the moment damage is dealt.
  infect: 'infect',
  wither: 'wither',
  toxic: 'toxic',
  // ⚠️ D308 - keywords that ARE triggered abilities, run natively from
  // `keywordTriggers.ts` for every permanent whose derived keywords carry
  // them. In the canon, so the accounting counts the printed line as the
  // engine's own and the derive carries a granted one.
  prowess: 'prowess',
  exalted: 'exalted',
  bushido: 'bushido',
  flanking: 'flanking',
  persist: 'persist',
  undying: 'undying',
  evolve: 'evolve',
  // D361 - the table, part 2. Scryfall spells each of these as the bare keyword
  // with the amount only in the printed text, exactly as it does for bushido.
  soulshift: 'soulshift',
  afterlife: 'afterlife',
  dethrone: 'dethrone',
  melee: 'melee',
  training: 'training',
  afflict: 'afflict',
  ingest: 'ingest',
  // D439 - the upkeep prices (Scryfall spells both as the bare keyword; the price is in the printed text).
  echo: 'echo',
  'cumulative upkeep': 'cumulativeUpkeep',
  // D440 - the table, part 3.
  extort: 'extort',
  modular: 'modular',
  // D444 - the entry choices: a +1/+1 counter or nothing (unleash), a +1/+1 counter or haste (riot).
  unleash: 'unleash',
  riot: 'riot',
  // D445 - the entry counters with a keyword grant.
  backup: 'backup',
  // D449 - the keyword alternative costs: evoke (sacrificed as it enters) and dash (haste; back to hand at the end step).
  evoke: 'evoke',
  dash: 'dash',
  // D450 - the counted-down keywords: time counters (vanishing) and fade counters (fading) off the upkeep.
  vanishing: 'vanishing',
  fading: 'fading',
  // D459 - fabricate N: the entry choice (counters or Servos) the keyword table runs.
  fabricate: 'fabricate',
  // D463 - mobilize N: the attack trigger that makes N Warriors tapped and attacking, sacrificed at the next end step.
  mobilize: 'mobilize',
  // D525 - cascade: the cast trigger the keyword table runs off the spell on the stack.
  cascade: 'cascade',
  // D536 - storm: the cast trigger that copies the spell for each spell cast before it this turn.
  storm: 'storm',
  // D556 - replicate: the cast trigger that copies the spell once per replicate payment.
  replicate: 'replicate',
  // D557 - conspire: the tap of two creatures that share a colour at cast, and the cast trigger that copies the spell once.
  conspire: 'conspire',
  // D585 - casualty: the sacrifice of a creature with power N or greater at cast, and the cast trigger that copies the spell once.
  casualty: 'casualty',
  // D558 - offspring: the cost at cast and the enters trigger that creates the permanent's 1/1 token copy.
  offspring: 'offspring',
  // D560 - blitz: the alternative cost's haste and sacrifice, and the dies trigger that draws.
  blitz: 'blitz',
  // D561 - recover: the graveyard trigger that asks for the recover cost - back to its owner's hand, or exiled.
  recover: 'recover',
  // D562 - enlist: the declaration's tap of another creature and the trigger that adds its power until end of turn.
  enlist: 'enlist',
  // D563 - harmonize: the graveyard cast for the harmonize cost, a creature tapped to reduce it by its power.
  harmonize: 'harmonize',
  // D564 - squad: the count paid at cast and the enters trigger that makes a token copy per payment.
  squad: 'squad',
  // D565 - sunburst: the entry counters for the colours of mana spent to cast it.
  sunburst: 'sunburst',
  // D570 - devour: the entering ask that sacrifices any number of creatures for N +1/+1 counters each.
  devour: 'devour',
  // D571 - champion: the enter trigger that exiles another of its kind (linked) or sacrifices it.
  champion: 'champion',
  // D573 - phasing: the untap step's turn action phases it out and back in.
  phasing: 'phasing',
  // D577 - daybound / nightbound (CR 702.145).
  daybound: 'daybound',
  nightbound: 'nightbound',
  // D545 - exploit: the enters trigger that may sacrifice a creature, tagged for the `exploits a creature` head.
  exploit: 'exploit',
  // D549 - myriad: the attack trigger's token copies toward every other opponent.
  myriad: 'myriad',
  // D550 - split second: the stack's lock on casts and non-mana activations.
  'split second': 'splitSecond',
  // D581 - mutate: the alternative cost's target, and the merge as the spell resolves.
  mutate: 'mutate',
  // D583 - haunt: exiled haunting target creature as it dies (or as the spell resolves), its abilities firing from exile.
  haunt: 'haunt',
  // D310 - characteristic-defining keywords the derive reads at layer 1.
  changeling: 'changeling',
  devoid: 'devoid',
  // D615 - start your engines! (CR 702.179a): the speed's start.
  'start your engines!': 'startYourEngines',
};

export function canonicalKeyword(raw: string): Keyword | null {
  return CANON[raw.trim().toLowerCase()] ?? null;
}

/**
 * `Toxic N` → N.
 *
 * ⚠️ Scryfall reports a bare `"Toxic"` with no amount, exactly as it does for
 * Landwalk and Protection, so the number comes from the text. Returns 0 when the
 * card has no toxic — and 0 is also the honest answer for a card whose toxic
 * amount we could not read, because a toxic of 0 adds no counters and therefore
 * enforces nothing rather than enforcing something wrong.
 */
export function parseToxic(oracleText: string): number {
  const m = /\btoxic\s+(\d+)\b/i.exec(oracleText ?? '');
  if (!m?.[1]) return 0;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * D570 - `Devour N` → N (CR 702.82a), off a printed line that IS the keyword and its number (its reminder may follow).
 * The variants read null - `Devour artifact 1`, `Devour Food 3`, `Devour land 3` (CR 702.82c) and `Devour X, where X
 * is...` - so none of them is the engine's: `parseKeywords` grants the keyword only on this reading, and the entering
 * ask reads N here.
 */
export function parseDevour(oracleText: string): number | null {
  const m = /^devour (\d+)(?: \(|$)/im.exec(oracleText ?? '');
  const n = Number(m?.[1] ?? '0');
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The land types a creature has landwalk for.
 *
 * Scryfall reports the keyword as `"Landwalk"` with no type, so the types have
 * to come from the text. `plainswalk` → `Plains`, and the non-basic forms
 * (`Legendary landwalk`, `Desertwalk`, `Snow landwalk`) are matched too because
 * they are the same rule with a different predicate.
 */
const LANDWALK_TYPES: readonly [RegExp, string][] = [
  [/\bplainswalk\b/i, 'Plains'],
  [/\bislandwalk\b/i, 'Island'],
  [/\bswampwalk\b/i, 'Swamp'],
  [/\bmountainwalk\b/i, 'Mountain'],
  [/\bforestwalk\b/i, 'Forest'],
  [/\bdesertwalk\b/i, 'Desert'],
  [/\blegendary landwalk\b/i, 'Legendary'],
  [/\bsnow landwalk\b/i, 'Snow'],
];

export function parseLandwalk(oracleText: string): string[] {
  const out: string[] = [];
  for (const [re, type] of LANDWALK_TYPES) if (re.test(oracleText)) out.push(type);
  return out;
}

/** Keywords that only matter on the battlefield, for the derive cache. */
export const COMBAT_KEYWORDS: ReadonlySet<Keyword> = new Set<Keyword>([
  'flying',
  'reach',
  'trample',
  'vigilance',
  'menace',
  'defender',
  'fear',
  'intimidate',
  'skulk',
  'shadow',
  'horsemanship',
]);
