// Which ENGINE PRIMITIVE is this line waiting on?
//
// ⚠️ THE QUESTION M6.3 HAS TO ANSWER, and it is not "what does this card do".
// The M6 brief's §6.1: "You cannot script twenty thousand cards until the engine
// can express what they do. Before generating anything, enumerate the missing
// decision primitives and build them… Measure the unlock: for every primitive,
// report how many Commander-legal cards become executable because of it. That
// number is how you decide what to build next."
//
// ⚠️ THE CRITICAL DISTINCTION IS `scriptable`. A card reading "When this creature
// enters, draw a card" needs NO new primitive: the trigger bus has existed since
// M3 and `effectParse`'s vocabulary already contains "draw a card". What it needs
// is a per-card SCRIPT, which is M6.4's job and not M6.3's. Counting it as a
// primitive gap would send this milestone off to build something that already
// works. So every line is first asked: could a script express you TODAY?
//
// ⚠️ AND THAT QUESTION IS ASKED OF `parseEffects`, the same closed vocabulary the
// engine actually runs — never of a second list written here. It is the third
// time this project has had to say that (the Command Tower lesson in `tier3.ts`,
// then D122's ledger), and it is what stops this report claiming a coverage the
// engine does not have.
//
// ⚠️ IT IS A MEASUREMENT, NOT A GATE. Nothing in the engine or the bot reads it.
// It classifies ENGLISH, so it is approximate by construction — which is why
// `unclassified` is a first-class bucket that gets REPORTED rather than a
// fallback that gets swallowed. A classifier with no residue is a classifier
// that is lying about something.

import type { CardData } from './cardTypes';
import { parseEffects } from './effectParse';
import { unaccountedLines, type UnaccountedLine } from './engineComplete';
import { parseTypeLine } from './oracleParse';

/**
 * The primitives the M6 brief names, plus the two the data added.
 *
 * ⚠️ `scriptable` is not a primitive — it is the ABSENCE of one, and it is the
 * most important number in the report.
 */
export type Primitive =
  | 'scriptable'
  // ⚠️ THE `effect:` FAMILY WAS NOT IN THE BRIEF'S LIST, and the first
  // measurement is why it exists. Classifying only the seven primitives §6.1
  // names left **68.7% of blocked cards unclassified** — a black box cannot
  // decide a build order. The residue was dominated by effects outside
  // `effectParse`'s eleven kinds (damage, destroy, exile, counter, bounce, pump,
  // tap, untap, draw, gainLife, loseLife). A trigger bus with nothing to say is
  // not a trigger bus, so widening the VOCABULARY is a primitive too.
  | 'effect:token'
  | 'effect:counter'
  | 'effect:sacrifice'
  | 'effect:mill'
  | 'effect:search'
  // Keyword ABILITIES the ingest reads and the engine does not run. Also absent
  // from §6.1, also a large share of the residue, and each is its own small
  // engine change rather than a script.
  | 'keyword:equip'
  | 'keyword:aura'
  | 'keyword:altCost'
  | 'keyword:other'
  // The brief's seven.
  | 'layer6'
  | 'chooseFromZone'
  | 'modal'
  | 'choice'
  | 'optional'
  | 'delayed'
  | 'duration'
  | 'costMod'
  | 'replacement'
  | 'unclassified';

export const PRIMITIVE_LABEL: Readonly<Record<Primitive, string>> = {
  scriptable: 'a per-card script, and nothing else (M6.4, not M6.3)',
  'effect:token': 'creating a token — the event exists, the effect kind does not',
  'effect:counter': 'putting counters on something',
  'effect:sacrifice': 'sacrificing a permanent',
  'effect:mill': 'milling',
  'effect:search': 'searching a library',
  'keyword:equip': 'Equip / Fortify / Reconfigure — attach for a cost',
  'keyword:aura': 'Enchant — what an Aura may be attached to',
  'keyword:altCost': 'Cycling, Kicker, Flashback, Convoke — an alternative or extra cost',
  'keyword:other': 'another keyword ability the engine does not run',
  layer6: 'layer 6 — granting an ability or keyword to something',
  chooseFromZone: 'choosing a card in a zone (discard, reanimate)',
  modal: '"choose one —"',
  choice: 'naming a colour, a card, or a creature type',
  optional: '"you may" — an optional trigger',
  delayed: 'a delayed trigger ("at the beginning of the next…")',
  duration: 'a continuous effect lasting longer than end of turn',
  costMod: 'cost modification (additional costs, cost reduction)',
  replacement: 'a replacement effect ("enters tapped", "…instead")',
  unclassified: 'nothing this report recognises',
};

/** `When …, ` / `Whenever …, ` / `At the beginning of …, ` → the effect after it. */
const TRIGGER_HEAD = /^(?:when|whenever|at the beginning of|at end of)\b[^,]*,\s*/i;

/**
 * Everything after a trigger's condition, or after an activated ability's colon.
 *
 * ⚠️ The FIRST comma, which is wrong for a condition that contains one ("Whenever
 * a creature you control dies, if it was a Goblin, …"). That is a known and
 * accepted imprecision: it can only make an effect look longer than it is, which
 * pushes a card OUT of `scriptable` and into a primitive bucket. The report errs
 * toward "needs more work", never toward "already handled".
 */
function effectOf(line: string): string {
  const colon = line.indexOf(':');
  if (colon >= 0) return line.slice(colon + 1).trim();
  const head = TRIGGER_HEAD.exec(line);
  return head ? line.slice(head[0].length).trim() : line;
}

const MAY = /\byou may\b/i;

/**
 * The line with its "you may" taken off, so what is LEFT can be asked about.
 *
 * ⚠️ A "may" is a MODIFIER on an effect, not an effect — which is exactly why it
 * cannot be classified without looking at what it modifies. See `primitiveFor`.
 */
function withoutMay(text: string): string {
  return text.replace(/\byou may\b\s*/gi, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Could a script express this effect today?
 *
 * ⚠️ `isInstantOrSorcery: true` is a deliberate lie to the parser, and the only
 * one in this file. `parseEffects` refuses a permanent outright (`effectParse.ts`
 * — "a permanent's text is a static or triggered ability that needs the script
 * registry and a trigger bus"), which is right for the INGEST and useless here:
 * the question is not "does this resolve by itself" but "is this sentence inside
 * the vocabulary a script could return events for". Forcing the flag asks that
 * second question with the same closed vocabulary.
 */
function expressible(effect: string, name: string): boolean {
  if (effect === '') return false;
  return parseEffects(effect, name, true).mode === 'auto';
}

/**
 * A whole line that IS a keyword ability, matched at both ends.
 *
 * ⚠️ Checked before anything else, because these are not sentences and reading
 * them as ones produces nonsense: `Equip {2}` has no verb, no target and no
 * comma, so every downstream rule declines it and it lands in `unclassified` —
 * 216 + 127 + 105 cards on the first run, for one keyword.
 *
 * ⚠️ They are ALSO the answer to a question §6.1 does not ask. Each is a small
 * engine change of its own (Equip is attach-for-a-cost, Cycling is an
 * alternative cost) rather than anything a card script could express, so they
 * belong in the build-order table beside the seven.
 */
const KEYWORD_LINES: readonly (readonly [Primitive, RegExp])[] = [
  ['keyword:equip', /^(?:equip|fortify|reconfigure)\b/i],
  ['keyword:aura', /^enchant\b/i],
  [
    'keyword:altCost',
    /^(?:cycling|kicker|multikicker|flashback|convoke|delve|escape|emerge|evoke|madness|overload|prowl|spectacle|surge|bestow|buyback|entwine|replicate|splice|affinity|improvise|dash|embalm|eternalize|jump-start|retrace|unearth|aftermath|awaken|foretell|disturb|blitz|casualty)\b/i,
  ],
  // A bare one- or two-word line with no verb is a keyword ability by shape.
  // ⚠️ The trailing number matters: `Crew 2`, `Annihilator 3` and `Toxic 1` are
  // keyword abilities whose AMOUNT is part of the ability, and a pattern that
  // only allowed a `{mana}` tail left 72 + 52 cards in the residue for Crew
  // alone.
  ['keyword:other', /^[A-Z][a-z]+(?:[ -][a-z]+)?(?: (?:\{[^}]+\}|\d+))?\.?$/],
];

/**
 * The four things the `layer6` bucket actually catches, named separately.
 *
 * ⚠️ **A BUCKET IS NOT A PRIMITIVE**, and this split is what stops M6.3 ticking
 * one off on the strength of a pattern that covers four different rules
 * subsystems. Only the first is CR 613.6:
 *
 *   · `grant`       — adding or removing an ability. D129 built it, in
 *                     timestamp order, and `applyStatics('ability')` runs it.
 *   · `anthem`      — "creatures you control get +1/+1". Layer 7c, carried by
 *                     `applyStatics('ptModify')` since M3.
 *   · `conditional` — "as long as". Works, because `appliesTo` is re-asked on
 *                     every derive rather than latched at resolution.
 *   · `restriction` — "can't block", "can't attack". CR 508/509, and NOT built:
 *                     those constrain a whole DECLARATION, and `canAttack` /
 *                     `canBlock` consult no static ability at all.
 *
 * ⚠️ `LAYER6` IS COMPOSED FROM THESE, never written out twice. The classifier
 * and the report have to agree about what a `layer6` line is, and the way this
 * repo has learnt to guarantee that is to have one source and ask it (D122's
 * ledger, and the Command Tower lesson before it). The composed source is the
 * same alternation in the same order it always was, which is why every pinned
 * figure in `primitives.node.test.ts` reproduces unchanged.
 */
const L6_GRANT =
  /\b(?:gains?|have|has|get)\b[^.]*\b(?:flying|trample|vigilance|haste|lifelink|deathtouch|first strike|double strike|menace|hexproof|indestructible|reach|defender|shroud|protection)\b/;
const L6_ANTHEM = /\b(?:creatures|permanents|lands|other \w+) you control (?:gets?|gains?|have|has)\b/;
const L6_RESTRICTION = /\bcan'?t be blocked\b|\bcan'?t attack\b|\bcan'?t block\b/;
const L6_CONDITIONAL = /\bas long as\b/;

const LAYER6 = new RegExp(
  [L6_GRANT, L6_ANTHEM, L6_RESTRICTION, L6_CONDITIONAL].map((r) => r.source).join('|'),
  'i',
);

export type Layer6Kind = 'grant' | 'anthem' | 'restriction' | 'conditional';

/**
 * What KIND of token a line asks to be created — a secondary classification of
 * lines already filed under `effect:token`, for the same reason `layer6Kind`
 * exists: a bucket is not a primitive, and this row has to be split before it
 * can be built. See D131.
 *
 * ⚠️ Unlike `LAYER6`, this is NOT a decomposition of the bucket's own pattern —
 * that pattern is "creates … token", one shape. This asks the different question
 * of what the token IS, because that is what decides the cost:
 *
 *   · `copy`       — CR 707 copiable values. A different primitive entirely
 *                    (M6.4-LIBRARY-SPEC §4.4), not a token problem.
 *   · `predefined` — Treasure, Food, Clue, Blood, Powerstone… a fixed list, and
 *                    the easiest to resolve because the NAME is printed.
 *   · `withAbilities` — "a 4/4 white Angel creature token with flying". The
 *                    abilities are part of the token's IDENTITY, not decoration:
 *                    `Angel 4/4 W "Flying"` and `Angel 4/4 W "Flying, vigilance"`
 *                    are two different printings distinguished by nothing else.
 *   · `variable`   — "create X tokens", not known at parse time.
 *   · `plain`      — "a 1/1 white Soldier creature token", no rules text.
 */
export type TokenKind = 'copy' | 'predefined' | 'withAbilities' | 'variable' | 'plain';

/**
 * The five things the `replacement` bucket catches — a fourth bucket split,
 * because three in a row (D129, D130, D131) found a row that was not a
 * primitive. See D134.
 *
 *   · `entersTapped` — "this land enters tapped". CR 614.1c, a SELF-replacement
 *                      with no choice, no ordering and no interaction. It is a
 *                      property of the card, readable from its text.
 *   · `entersWith`   — "enters with three +1/+1 counters on it". The same clause
 *                      one step harder: the AMOUNT has to be read.
 *   · `asEnters`     — "as this enters, choose a colour". A replacement with a
 *                      PROMPT inside it, and the choice has to be remembered.
 *   · `wouldInstead` — "if a creature would die, exile it instead". The real
 *                      CR 614 machinery: an event is intercepted and rewritten.
 *   · `instead`      — anything else claiming the word.
 *
 * ⚠️ Composed into `REPLACEMENT` in the bucket's original order, so every figure
 * D127 pinned reproduces unchanged — the same guarantee `LAYER6` gives.
 */
export type ReplacementKind = 'entersTapped' | 'entersWith' | 'asEnters' | 'wouldInstead' | 'instead';

const RP_ENTERS_TAPPED = /\benters (?:the battlefield )?tapped\b/;
const RP_ENTERS_WITH = /\benters (?:the battlefield )?with\b/;
const RP_WOULD_INSTEAD = /\bif [^.]*would [^.]*instead\b/;
const RP_INSTEAD = /\binstead\b/;
const RP_AS_ENTERS = /\bas [^.]*enters\b/;

const REPLACEMENT = new RegExp(
  [RP_ENTERS_TAPPED, RP_ENTERS_WITH, RP_WOULD_INSTEAD, RP_INSTEAD, RP_AS_ENTERS]
    .map((r) => r.source)
    .join('|'),
  'i',
);

/** Which of the five a `replacement` line is, in the alternation's own order. */
export function replacementKind(text: string): ReplacementKind | null {
  if (new RegExp(RP_ENTERS_TAPPED.source, 'i').test(text)) return 'entersTapped';
  if (new RegExp(RP_ENTERS_WITH.source, 'i').test(text)) return 'entersWith';
  if (new RegExp(RP_WOULD_INSTEAD.source, 'i').test(text)) return 'wouldInstead';
  if (new RegExp(RP_INSTEAD.source, 'i').test(text)) return 'instead';
  if (new RegExp(RP_AS_ENTERS.source, 'i').test(text)) return 'asEnters';
  return null;
}

const TK_COPY = /\bcopy\b/i;
const TK_PREDEFINED =
  /\b(?:Treasure|Food|Clue|Blood|Gold|Powerstone|Incubator|Map|Junk|Shard|Lander)\b/;
const TK_WITH_ABILITIES = /\btokens?\b[^.]*\bwith\b|\btokens?\b[^.]*"/i;
const TK_VARIABLE = /\bX\b/;

/** In order: the first that matches wins, most specific first. */
export function tokenKind(text: string): TokenKind | null {
  if (!/\btokens?\b/i.test(text)) return null;
  if (TK_COPY.test(text)) return 'copy';
  if (TK_PREDEFINED.test(text)) return 'predefined';
  if (TK_WITH_ABILITIES.test(text)) return 'withAbilities';
  if (TK_VARIABLE.test(text)) return 'variable';
  return 'plain';
}

/**
 * Which of the four a `layer6` line is, in the alternation's own order.
 *
 * `null` for a line the bucket does not claim at all — which cannot happen for a
 * line `primitiveFor` filed under `layer6`, and is returned rather than thrown
 * so a caller that asks about the wrong line gets an answer it can report.
 */
export function layer6Kind(text: string): Layer6Kind | null {
  if (new RegExp(L6_GRANT.source, 'i').test(text)) return 'grant';
  if (new RegExp(L6_ANTHEM.source, 'i').test(text)) return 'anthem';
  if (new RegExp(L6_RESTRICTION.source, 'i').test(text)) return 'restriction';
  if (new RegExp(L6_CONDITIONAL.source, 'i').test(text)) return 'conditional';
  return null;
}

/**
 * What an `unclassified` line is ABOUT — the fifth bucket split, and the biggest
 * (D157).
 *
 * ⚠️ **`unclassified` IS THE LARGEST ROW IN THE REPORT BY A FACTOR OF FOUR**
 * (7,779 cards by sole need), and until this it was a black box that the build
 * order could say nothing about. "Split the row before building it" — the lesson
 * D129, D130, D131 and D134 each earned — applies hardest to the row nobody had
 * looked inside.
 *
 * ⚠️ **THIS IS A SECONDARY CLASSIFICATION, NOT A NEW PRIMITIVE ROW.** A line
 * filed here is still `unclassified`, still counted as unrecognised, and still
 * blocked. Naming what it is about does not make it expressible, and moving
 * these into `RULES` would shrink the residue by relabelling it — which is the
 * one way this report could lie about its own coverage.
 *
 *   · `activatedCost` — an ability with a cost line (`X: do something`). The
 *     largest named family, and it is a real primitive gap: `activatedParse`
 *     offers only abilities whose whole cost the engine can CHARGE, so
 *     "Sacrifice a creature:" is a decision rather than a price (D68, D122).
 *   · `triggeredShell` — a trigger whose CONDITION reads fine and whose payload
 *     does not. These need the effect vocabulary, not a trigger primitive.
 *   · `damage`, `exile`, `lifeGainLoss`, `drawDiscard`, `tokensAndCounters` —
 *     effects the vocabulary already has in SOME form, on a wording it cannot
 *     read. They shrink as `effectParse` widens, exactly like the `effect:*`
 *     rows.
 *   · `attackBlock`, `staticShell` — combat and continuous shapes.
 *   · `copySpell` (CR 707), `gainControl` (layer 2), `cantBeCountered`,
 *     `wardHexproofGrant` — each a named M6.4 class.
 *   · `other` — genuinely unnamed. **The number this file is honest about.**
 */
export type ResidueKind =
  | 'activatedCost'
  | 'triggeredShell'
  | 'damage'
  | 'exile'
  | 'lifeGainLoss'
  | 'drawDiscard'
  | 'tokensAndCounters'
  | 'attackBlock'
  | 'staticShell'
  | 'copySpell'
  | 'gainControl'
  | 'cantBeCountered'
  | 'wardHexproofGrant'
  | 'other';

/** In order: the first that matches wins, most structural first. */
const RESIDUE: readonly (readonly [ResidueKind, RegExp])[] = [
  // ⚠️ FIRST, because it is a property of the LINE'S SHAPE rather than of its
  // words: everything after the colon is a payload that could be anything.
  ['activatedCost', /^[^:]{1,40}:\s/],
  ['exile', /\bexiles?\b|\bexiled\b/i],
  ['gainControl', /\bgains? control\b/i],
  ['copySpell', /\bcopy\b|\bcopies\b/i],
  ['cantBeCountered', /\bcan'?t be countered\b/i],
  ['wardHexproofGrant', /\bward\b|\bhexproof\b|\bshroud\b/i],
  ['lifeGainLoss', /\bgains? \d+ life\b|\bloses? \d+ life\b|\bpays? \d+ life\b/i],
  ['damage', /\bdeals? \d+ damage\b|\bdeals? damage\b/i],
  ['drawDiscard', /\bdraws? \w+ cards?\b/i],
  ['tokensAndCounters', /\btokens?\b|\bcounters?\b/i],
  ['attackBlock', /\battacks?\b|\bblocks?\b|\bcombat damage\b/i],
  ['triggeredShell', /^(?:when|whenever|at the beginning of)\b/i],
  ['staticShell', /\byou control\b|\beach (?:player|opponent|creature)\b/i],
];

export function residueKind(text: string): ResidueKind {
  for (const [kind, re] of RESIDUE) if (re.test(text)) return kind;
  return 'other';
}

const RULES: readonly (readonly [Primitive, RegExp])[] = [
  // Ordered: the first match wins, most specific first.
  //
  // ⚠️ THE `effect:` RULES COME FIRST, because they answer "what would a script
  // have to return" and the structural rules answer "what shape is this line".
  // A trigger that creates a token is blocked on the token effect, not on the
  // trigger — and matching the structure first would file it under whatever
  // clause happened to be in the same sentence.
  ['effect:token', /\bcreates?\b[^.]*\btokens?\b|\bput\b[^.]*\btokens?\b onto the battlefield/i],
  ['effect:counter', /\b(?:put|puts|with|remove)\b[^.]*\bcounters?\b(?!\s*(?:target|that|it))|\bproliferate\b/i],
  ['effect:sacrifice', /\bsacrifices?\b/i],
  ['effect:mill', /\bmills?\b|\bputs? the top \w+ cards? .* into (?:your|their|its owner's) graveyard\b/i],
  ['effect:search', /\bsearch(?:es)? (?:your|target player'?s?|their|a) (?:library|graveyard)\b/i],
  ['modal', /\bchoose (?:one|two|three|up to one|up to two)\b|\bchoose one or both\b/i],
  ['choice', /\b(?:choose|name) a (?:colou?r|creature type|card name|land type|player)\b|\bthe chosen (?:colou?r|type)\b/i],
  ['chooseFromZone', /\bsearch (?:your|target player'?s?|a) (?:library|graveyard)\b|\bdiscards? (?:a|an|two|three|\d+|that|their) card|\bfrom your (?:graveyard|hand) (?:to|onto)\b|\breturn (?:target|a|another) [^.]*card (?:from|in) (?:your|a|target)? ?graveyard\b|\blook at the top \w+ cards?\b/i],
  ['costMod', /\bas an additional cost\b|\bcosts? \{[^}]*\} (?:less|more)\b|\bspells? (?:you cast )?costs?\b|\bpay \{[^}]*\} (?:more|less)\b/i],
  ['replacement', REPLACEMENT],
  ['delayed', /\bat the beginning of the next\b|\bat the beginning of your next\b|\bwhen [^.]*next\b|\buntil your next turn\b/i],
  ['duration', /\bfor as long as\b|\buntil end of combat\b|\bfor the rest of the game\b|\bthis turn\b(?![^.]*\bdeals?\b)/i],
  ['layer6', LAYER6],
];

/**
 * Shapes a `SpellDef` genuinely CANNOT express (D191) — each names a class
 * with real missing machinery, so a spell line carrying one keeps its row or
 * its residue instead of joining `scriptable`:
 *
 *   · modal choices — no mode-choosing cast prompt exists;
 *   · randomness in any clothes (at random / coins / rolls / SHUFFLE — a
 *     shuffle consumes the seeded RNG) — `ctx.random` is unwired (D158);
 *   · library search and any "you/opponent chooses" — script-raised prompts,
 *     a standing refusal class;
 *   · votes, copies (CR 707), control/life exchanges, extra turns (rules
 *     hooks), "outside the game" (needs the sideboard feature), punisher
 *     "unless" choices, damage division;
 *   · a run of blanked spaces — `scrub` erases QUOTED granted text with
 *     spaces of the same length, so the line reads as less than it is
 *     (D132's invisible gap).
 *
 * ⚠️ AN EXCLUSION LIST BOUNDS THE OVERCLAIM, IT DOES NOT PERFECT IT (D153's
 * lesson pointed the other way): a structural shape this list misses inflates
 * `scriptableToday` until the per-batch classification refuses the card and
 * the ledger names its class — at which point the shape belongs HERE too.
 */
const SPELL_STRUCTURAL: readonly RegExp[] = [
  /\bchoose (one|two|three|four|up to)\b/i,
  /\bat random\b/i,
  /\bcoin\b/i,
  /\broll\b/i,
  /\bshuffle\b/i,
  /\bsearch\b/i,
  /\bvote\b|\bcouncil\b/i,
  /\bcop(y|ies)\b/i,
  /\bexchange\b/i,
  /\bextra turn\b/i,
  /\boutside the game\b/i,
  /\bunless\b/i,
  /\bdivided as you choose\b|\bdistribute\b|\bany number of\b/i,
  /\bchooses?\b/i,
  /\s{2,}/,
  // ⚠️ CAST-TIME PROPERTIES — a `resolve` runs at RESOLUTION, so a line about
  // how the spell is CAST or what happens to it ON THE STACK is inexpressible
  // by construction, not merely unread: "can't be countered" is stack
  // interaction (spec §4.8), an additional cost is charged at CR 601.2, and a
  // cast restriction gates legality before any resolve exists. These are
  // one-line spells, so without this they would surface at the FRONT of a
  // lines-count-ordered wave as guaranteed draft refusals.
  /\bcan't be countered\b/i,
  /\ban additional cost\b/i,
  /\bcast (this spell|~) only\b/i,
  /\bspend only\b/i,
];

/** What one unaccounted line is waiting on. */
export function primitiveFor(line: UnaccountedLine, cardName: string, spellFace = false): Primitive {
  const text = line.text;

  // A keyword ability is not a sentence — check the shape before reading it as
  // one. See `KEYWORD_LINES`.
  for (const [primitive, re] of KEYWORD_LINES) if (re.test(text)) return primitive;

  const effect = effectOf(text);
  // The whole point: is a script all this needs?
  if (expressible(effect, cardName)) return 'scriptable';

  // ⚠️⚠️ **`optional` ONLY WHEN THE "YOU MAY" IS ALL THAT IS MISSING**, and this
  // is the one rule in the file that was measured WRONG rather than merely
  // narrow. See D153.
  //
  // It used to be tested FIRST — ahead of `expressible` and every rule below —
  // on the reasoning that "you may" can wrap an effect that is otherwise
  // perfectly expressible. True of some lines and false of most: a line reading
  // "you may search your library for a basic land card" came back `optional`,
  // and its library search was counted nowhere at all. Measured over the
  // database: of the **4,549 lines** the row caught that way, **169 — 3.7% —
  // needed nothing but the yes/no.** The other 4,380 belong to `chooseFromZone`
  // (626), `effect:counter` (390), `duration` (295), `effect:sacrifice` (257),
  // `effect:search` (231), `effect:token` (199) and nine more rows.
  //
  // ⚠️ **A PRE-FILTER DEFEATS `unlockedBy`, whose whole job is to require EVERY
  // line to be covered.** `optional` is in the report's BUILT set, so every one
  // of those 4,380 lines was being counted as already handled: the report claimed
  // **3,463** scriptable cards where the honest figure is **1,362**, an inflation
  // of 2,101 cards that was live from D128 to D153.
  //
  // ⚠️ And it moved the BUILD ORDER this file exists to decide. `optional` led
  // D127's table at 2,012 cards by sole need; measured properly it is **96**, the
  // second SMALLEST row. It was built first and that did no harm — the flag
  // already existed and the work was one prompt — but the number that justified
  // going first was an artefact of this check's position.
  if (MAY.test(text)) {
    const rest = withoutMay(text);
    if (rest !== '' && expressible(effectOf(rest), cardName)) return 'optional';
  }

  for (const [primitive, re] of RULES) if (re.test(text)) return primitive;

  // ⚠️⚠️ **D191 — THE SEAM THE NEEDS COLUMN COULD NOT SEE.** Since D187 a
  // `SpellDef` resolves an instant or sorcery's WHOLE text from `resolveTop`,
  // so a spell line the vocabulary cannot read is no longer blocked on the
  // vocabulary at all — a script expresses it directly, the same standard as
  // a trigger resolve. Measured before this branch existed: flipping the
  // selection's "no spells" filter moved the offerable pool 584 → 583,
  // because every unreadable spell line filed into a row or the residue and
  // no spell ever reached sole-need-`scriptable`.
  //
  // ⚠️ ONLY the residue spills — a spell line a RULES row caught above keeps
  // its row, because those name machinery a spell def lacks exactly the way
  // a trigger def does (prompts, temporary grants, CR 707). And only past
  // the STRUCTURAL list, which names what a resolve cannot express.
  if (spellFace && !SPELL_STRUCTURAL.some((re) => re.test(text))) return 'scriptable';

  return 'unclassified';
}

export interface CardPrimitives {
  /** Every primitive any of this card's unaccounted lines needs. */
  readonly needs: ReadonlySet<Primitive>;
  readonly lines: readonly { readonly text: string; readonly primitive: Primitive }[];
}

/** Every face of a card, classified. */
export function primitivesFor(card: CardData): CardPrimitives {
  const lines: { text: string; primitive: Primitive }[] = [];
  for (let i = 0; i < card.faces.length; i++) {
    // D191: a SPELL face's lines are scriptable by the seam (see
    // `primitiveFor`); asked of THE type-line parser, never a second regex.
    const types = parseTypeLine(card.faces[i]?.typeLine ?? '').types;
    const spellFace = types.includes('Instant') || types.includes('Sorcery');
    for (const line of unaccountedLines(card, i)) {
      lines.push({ text: line.text, primitive: primitiveFor(line, card.name, spellFace) });
    }
  }
  return { needs: new Set(lines.map((l) => l.primitive)), lines };
}

/**
 * Would this card be executable if `built` existed?
 *
 * ⚠️ EVERY line has to be covered, which is D90's rule applied to a roadmap:
 * a card that needs layer 6 AND a library search is unlocked by neither alone.
 * That is what makes the cumulative column the honest one and the per-primitive
 * column an upper bound.
 */
export function unlockedBy(card: CardPrimitives, built: ReadonlySet<Primitive>): boolean {
  if (card.lines.length === 0) return true;
  return card.lines.every((l) => built.has(l.primitive));
}
