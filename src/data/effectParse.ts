// What a card DOES, parsed once at ingest — the part the engine executes.
//
// ⚠️ THE RULE THAT SHAPES EVERY LINE BELOW: never half-execute a card. A face is
// `auto` only when EVERY sentence of it is understood. `Beast Within` reads
// "Destroy target permanent. Its controller creates a 3/3 green Beast creature
// token." — destroying the permanent and silently skipping the token is worse
// than doing nothing, because the player cannot see what was missed and has no
// reason to check. Measured over the Commander-legal pool: 274 spells are
// understood completely, 1,300 are this shape. The 1,300 become `assisted` — the
// app offers the part it understands as a one-click, logged, manual action and
// says the rest is yours.
//
// ⚠️ THE VOCABULARY IS CLOSED, and that is what makes the rule hold. The first
// cut of this used `[a-z ]+` for a target phrase and "understood" Homing
// Lightning ("deals 4 damage to target creature AND each other creature with the
// same name as that creature") and Spell Blast ("counter target spell WITH MANA
// VALUE X"). Both matched on their prefix. A closed noun list cannot do that:
// anything outside it simply is not understood.
//
// ⚠️ Same Tier-2 boundary as everywhere else — an effect the engine cannot
// express as EVENTS is an effect it must not claim. `tier3.ts` asks this module
// what it understood, and says so on the card.

import type { EffectKind, EffectMode, EffectSpec } from '../engine/types/oracle';
import type { Warn } from './oracleParse';
import { scrub } from './targetParse';

const NOOP_WARN: Warn = () => undefined;

/**
 * The target phrases this module admits, matching the coarse kinds `TargetSpec`
 * already models. Longest first, so `creature or planeswalker` cannot be eaten
 * by `creature`.
 */
const NOUNS = [
  'attacking or blocking creature',
  'creature an opponent controls',
  "creature you don't control",
  'creature you don’t control',
  'instant or sorcery spell',
  'artifact or enchantment',
  'creature or planeswalker',
  'player or planeswalker',
  'creature or enchantment',
  'artifact or creature',
  'creature or player',
  'permanent you control',
  'attacking creature',
  'blocking creature',
  'creature you control',
  'artifact you control',
  'nonland permanent',
  'noncreature spell',
  'creature spell',
  'planeswalker',
  'enchantment',
  'permanent',
  'creatures',
  'creature',
  'opponent',
  'artifact',
  'players',
  'player',
  'spell',
  'land',
].join('|');

const TARGET = `(?:any target|target (?:${NOUNS}))`;
const NUM = '(?:\\d+)';

const WORD_NUMBERS: Readonly<Record<string, number>> = {
  a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
};

function num(raw: string | undefined): number | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key in WORD_NUMBERS) return WORD_NUMBERS[key] ?? null;
  if (/^\d+$/.test(key)) return Number(key);
  return null; // "X" is not known at parse time.
}

/** `kind` comes from the rule; `text` is the sentence. The rest is built here. */
type EffectFields = Omit<EffectSpec, 'text' | 'kind'>;

interface Rule {
  readonly kind: EffectKind;
  readonly re: RegExp;
  /** Builds the spec, or returns null when a captured number is unusable. */
  readonly build: (m: RegExpMatchArray) => EffectFields | null;
}

const BASE: EffectFields = { amount: 0, power: 0, toughness: 0, targetIndex: 0, self: false };

/**
 * ⚠️ Every pattern is anchored at BOTH ends. A sentence with anything left over
 * is not understood — that is the whole safety property, and the reason these
 * read as strict rather than helpful.
 */
const RULES: readonly Rule[] = [
  {
    kind: 'damage',
    re: new RegExp(`^~ deals (${NUM}) damage to ${TARGET}\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n };
    },
  },
  { kind: 'destroy', re: new RegExp(`^destroy ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  { kind: 'exile', re: new RegExp(`^exile ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  { kind: 'counter', re: new RegExp(`^counter ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  {
    kind: 'bounce',
    re: new RegExp(`^return ${TARGET} to (?:its|their) owner(?:'|’)?s? hand\\.$`, 'i'),
    build: () => ({ ...BASE }),
  },
  {
    kind: 'pump',
    re: new RegExp(`^${TARGET} gets ([+-]${NUM})/([+-]${NUM}) until end of turn\\.$`, 'i'),
    build: (m) => {
      const p = Number(m[1]);
      const t = Number(m[2]);
      return Number.isFinite(p) && Number.isFinite(t) ? { ...BASE, power: p, toughness: t } : null;
    },
  },
  { kind: 'tap', re: new RegExp(`^tap ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  { kind: 'untap', re: new RegExp(`^untap ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  {
    kind: 'draw',
    re: /^(?:you )?draw (a|one|two|three|four|five|six|seven|\d+) cards?\.$/i,
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  {
    kind: 'gainLife',
    re: new RegExp(`^you gain (${NUM}) life\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  {
    kind: 'loseLife',
    re: new RegExp(`^target (?:player|opponent) loses (${NUM}) life\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n };
    },
  },
];

/**
 * Replace the card's own name with `~`, so a self-reference does not defeat
 * matching. Lightning Bolt's text literally says "Lightning Bolt deals 3 damage".
 */
export function selfRef(text: string, name: string): string {
  if (!name) return text;
  let out = text.split(name).join('~');
  const short = name.split(',')[0];
  if (short && short !== name) out = out.split(short).join('~');
  // Modern templating uses "This spell"/"This creature" for the same thing.
  return out.replace(/\bThis (?:spell|creature|permanent|artifact|enchantment|land)\b/g, '~');
}

/** Split a scrubbed face into sentences, keeping the terminator. */
function sentences(text: string): string[] {
  return text
    .split('\n')
    .flatMap((line) => line.split(/(?<=\.)\s+/))
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function matchSentence(sentence: string): EffectSpec | null {
  for (const rule of RULES) {
    const m = sentence.match(rule.re);
    if (!m) continue;
    const built = rule.build(m);
    if (!built) return null;
    return { ...built, kind: rule.kind, text: sentence };
  }
  return null;
}

export interface ParsedEffects {
  readonly effects: readonly EffectSpec[];
  readonly mode: EffectMode;
}

/**
 * What this face does, and how much of it the app will do for the player.
 *
 * ⚠️ Only INSTANTS and SORCERIES are considered. A permanent's text is a static
 * or triggered ability that needs the script registry and a trigger bus, not a
 * one-shot resolution — and pretending otherwise would execute a creature's
 * "whenever this attacks" the moment it entered the battlefield.
 */
export function parseEffects(
  oracleText: string,
  cardName: string,
  isInstantOrSorcery: boolean,
  warn: Warn = NOOP_WARN,
): ParsedEffects {
  if (!isInstantOrSorcery || !oracleText) return { effects: [], mode: 'manual' };

  const clean = scrub(selfRef(oracleText, cardName));
  const lines = sentences(clean);
  if (lines.length === 0) return { effects: [], mode: 'manual' };

  const effects: EffectSpec[] = [];
  let understood = 0;
  // Each understood clause consumes the next target in printed order, which is
  // the same order `targetParse` produced its specs in.
  let nextTarget = 0;
  for (const line of lines) {
    const spec = matchSentence(line);
    if (!spec) continue;
    understood++;
    effects.push(spec.targetIndex === -1 ? spec : { ...spec, targetIndex: nextTarget++ });
  }

  if (understood === 0) {
    warn('effect:none');
    return { effects: [], mode: 'manual' };
  }
  if (understood < lines.length) {
    // ⚠️ The important branch. Understood-but-incomplete NEVER runs by itself.
    warn('effect:partial');
    return { effects, mode: 'assisted' };
  }
  warn('effect:auto');
  return { effects, mode: 'auto' };
}
