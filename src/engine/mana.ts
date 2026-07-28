// Mana sources on the board, and turning a cost into a payment problem.

import type { ColorLetter } from '../data/cardTypes';
import { derive, type DeriveCache } from './derive';
import type { ScriptRegistry } from './scripts/registry';
import type { InstanceId, PlayerId } from './types/ids';
import {
  COLORS,
  EMPTY_POOL,
  poolFrom,
  poolTotal,
  type Color,
  type HybridOption,
  type HybridRequirement,
  type ManaCost,
  type ManaPool,
  type ManaSymbolKey,
  type PaymentProblem,
} from './types/mana';
import type { ManaOutput, OracleDb } from './types/oracle';
import type { GameState } from './types/state';

/** One tappable mana ability, with its `anyColor` already expanded. */
export interface ManaSource {
  readonly card: InstanceId;
  readonly abilityIndex: number;
  readonly outputs: readonly ManaOutput[];
  readonly requiresTap: boolean;
  readonly conditional: boolean;
  /**
   * Spend the LEAST flexible source first. A basic Forest is 0; an any-colour
   * creature is 6. This is what makes an auto-tap suggestion *good* rather than
   * merely legal — hoarding Command Tower and not tapping a mana dork you might
   * want to attack with is the difference between the feature being used and
   * being switched off.
   */
  readonly flexibilityRank: number;
}

/** Which colours a source can make at all, for the necessary-condition filter. */
export function colorsOf(source: ManaSource): Set<ManaSymbolKey> {
  const out = new Set<ManaSymbolKey>();
  for (const o of source.outputs) {
    for (const k of ['W', 'U', 'B', 'R', 'G', 'C'] as const) if (o.mana[k] > 0) out.add(k);
  }
  return out;
}

export function maxAmount(source: ManaSource): number {
  let best = 0;
  for (const o of source.outputs) best = Math.max(best, o.amount);
  return best;
}

/**
 * Every mana ability a player could activate right now.
 *
 * `includeConditional` is false for auto-tap and true for the manual tap menu:
 * a conditional source ("Spend this mana only on…", or one with a cost beyond
 * {T}) is a decision the player must make, so the solver may not make it for
 * them — but the source must still be tappable by hand. That is the
 * Tier-2/Tier-3 line, made explicit rather than guessed at.
 */
export function manaSourcesOf(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
  opts: { includeConditional?: boolean; includeTapped?: boolean; cache?: DeriveCache } = {},
): ManaSource[] {
  const identity = state.players[player]?.identity ?? [];
  const out: ManaSource[] = [];
  for (const id of state.zones.battlefield) {
    const card = state.cards[id];
    if (!card || card.controller !== player) continue;
    if (card.phasedOut) continue;
    const d = derive(state, oracle, scripts, id, opts.cache);
    for (const prod of d.producesMana) {
      if (prod.conditional && !opts.includeConditional) continue;
      if (prod.requiresTap && card.tapped && !opts.includeTapped) continue;
      // Summoning sickness stops a creature using a {T} ability. CR 302.6 —
      // and it is the single most common "why can't I tap this" question.
      if (prod.requiresTap && d.isCreature && !canTapForAbility(state, card.id, d)) continue;
      const outputs = expandOutputs(prod.outputs, prod.anyColor, identity);
      if (outputs.length === 0) continue;
      out.push({
        card: id,
        abilityIndex: prod.abilityIndex,
        outputs,
        requiresTap: prod.requiresTap,
        conditional: prod.conditional,
        flexibilityRank: rankOf(d, outputs),
      });
    }
  }
  return out;
}

function canTapForAbility(
  state: GameState,
  id: InstanceId,
  d: ReturnType<typeof derive>,
): boolean {
  const card = state.cards[id];
  if (!card) return false;
  if (!d.isCreature) return true;
  if (d.keywords.has('haste')) return true;
  return card.summonedOnTurn === null || card.summonedOnTurn < state.turn.turnNumber;
}

/**
 * "Add one mana of any colour" resolved into concrete options.
 *
 * ⚠️ `scope: 'identity'` is Command Tower, and the engine knows the controller's
 * commander colour identity exactly — so this is a lookup, not a guess. A
 * colourless commander's Tower correctly produces nothing, which is the rule.
 */
function expandOutputs(
  outputs: readonly ManaOutput[],
  anyColor: { scope: 'all' | 'identity'; amount: number } | null,
  identity: readonly ColorLetter[],
): ManaOutput[] {
  if (!anyColor) return [...outputs];
  const colors: readonly Color[] = anyColor.scope === 'identity' ? (identity as readonly Color[]) : COLORS;
  return colors.map((c) => ({
    mana: poolFrom({ [c]: anyColor.amount }),
    amount: anyColor.amount,
  }));
}

function rankOf(d: ReturnType<typeof derive>, outputs: readonly ManaOutput[]): number {
  const options = outputs.length;
  if (d.isCreature) return 6;
  if (d.isLand) {
    if (d.typeLine.supertypes.includes('Basic')) return 0;
    return options > 1 ? 2 : 1;
  }
  return options > 1 ? 4 : 3;
}

// ── costs → payment problems ─────────────────────────────────────────────────

const NO_COLORED: Readonly<Record<Color, number>> = { W: 0, U: 0, B: 0, R: 0, G: 0 };

export const FREE_PROBLEM: PaymentProblem = {
  colored: NO_COLORED,
  colorless: 0,
  generic: 0,
  snow: 0,
  hybrids: [],
  additionalLife: 0,
  totalMana: 0,
};

/**
 * Fold a printed cost, X, commander tax, ward and any additional costs into the
 * single problem the solver sees.
 *
 * ⚠️ Snow is folded into GENERIC. Restricted mana is out of scope for v1 (spec
 * Q8) and the pool is modelled as plain counts, so `{S}` becomes "one mana of
 * anything". That is a documented over-permissiveness: a deck with no snow
 * permanents can cast a snow spell. The alternative — refusing to pay `{S}` at
 * all — would make those cards uncastable, which is worse and less honest.
 */
export function buildPaymentProblem(
  base: ManaCost | null,
  xValue: number,
  additional: readonly ManaCost[],
  commanderTax: number,
  additionalLife = 0,
): PaymentProblem {
  const colored: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let colorless = 0;
  let generic = commanderTax;
  const hybrids: HybridRequirement[] = [];

  const fold = (cost: ManaCost | null): void => {
    if (!cost) return;
    for (const c of COLORS) colored[c] += cost.colored[c];
    colorless += cost.colorless;
    generic += cost.generic + cost.snow + cost.xCount * Math.max(0, xValue);
    for (const h of cost.hybrids) hybrids.push({ index: hybrids.length, options: h.options });
  };

  fold(base);
  for (const extra of additional) fold(extra);

  let totalMana = colorless + generic;
  for (const c of COLORS) totalMana += colored[c];
  for (const h of hybrids) totalMana += minManaFor(h.options);

  return { colored, colorless, generic, snow: 0, hybrids, additionalLife, totalMana };
}

/**
 * The ward surcharge for a set of targeted faces. CR 702.21a, as a cast-time tax.
 *
 * ⚠️ SHARED BY THE HOST AND THE CLIENT, and that is the entire reason it lives
 * here rather than beside either caller. D53: the one thing an auto-tapper must
 * never do is let a player approve one payment and be charged another. The host
 * looks a target up in `GameState` and the client looks it up in a `PlayerView`
 * — those genuinely differ — but the arithmetic they do afterwards must not, so
 * only the lookup is duplicated and never the sum.
 *
 * The caller is responsible for passing ONLY faces of permanents an opponent
 * controls. Your own warded creature is free.
 */
export function wardTaxFrom(
  faces: readonly { readonly wardCost: ManaCost | null; readonly wardLife: number }[],
): { mana: ManaCost[]; life: number } {
  const mana: ManaCost[] = [];
  let life = 0;
  for (const face of faces) {
    if (face.wardCost) mana.push(face.wardCost);
    life += face.wardLife;
  }
  return { mana, life };
}

/** The cheapest a hybrid can be in MANA (a phyrexian half costs zero mana). */
export function minManaFor(options: readonly HybridOption[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const o of options) {
    const cost = o.kind === 'life' ? 0 : o.kind === 'generic' ? o.amount : 1;
    best = Math.min(best, cost);
  }
  return Number.isFinite(best) ? best : 1;
}

/** A problem with every hybrid already resolved. What the solver actually solves. */
export interface ConcreteProblem {
  readonly colored: Readonly<Record<Color, number>>;
  readonly colorless: number;
  readonly generic: number;
  readonly lifeCost: number;
  readonly totalMana: number;
  readonly hybridChoices: readonly { readonly index: number; readonly option: number }[];
}

/**
 * Every way the hybrids could be resolved, cheapest-and-least-painful first.
 *
 * Capped at 64 combinations, as the spec prescribes. A card with 7+ hybrid
 * symbols essentially does not exist; if one shows up the payment falls back to
 * manual tapping, which is an honest answer rather than a wrong one.
 */
export function hybridCombinations(problem: PaymentProblem, cap = 64): ConcreteProblem[] {
  const out: ConcreteProblem[] = [];
  const walk = (index: number, choices: { index: number; option: number }[]): void => {
    if (out.length >= cap) return;
    if (index >= problem.hybrids.length) {
      out.push(concretise(problem, choices));
      return;
    }
    const req = problem.hybrids[index];
    if (!req) return;
    for (let option = 0; option < req.options.length; option++) {
      walk(index + 1, [...choices, { index: req.index, option }]);
      if (out.length >= cap) return;
    }
  };
  walk(0, []);
  // Prefer not paying life, then fewer total mana, then coloured over generic.
  return out.sort((a, b) => a.lifeCost - b.lifeCost || a.totalMana - b.totalMana);
}

function concretise(
  problem: PaymentProblem,
  choices: readonly { index: number; option: number }[],
): ConcreteProblem {
  const colored: Record<Color, number> = { ...problem.colored };
  let colorless = problem.colorless;
  let generic = problem.generic + problem.snow;
  let lifeCost = problem.additionalLife;
  for (const choice of choices) {
    const req = problem.hybrids.find((h) => h.index === choice.index);
    const option = req?.options[choice.option];
    if (!option) continue;
    switch (option.kind) {
      case 'color':
        colored[option.color]++;
        break;
      case 'colorless':
        colorless++;
        break;
      case 'snow':
        generic++;
        break;
      case 'generic':
        generic += option.amount;
        break;
      case 'life':
        lifeCost += option.amount;
        break;
    }
  }
  let totalMana = colorless + generic;
  for (const c of COLORS) totalMana += colored[c];
  return { colored, colorless, generic, lifeCost, totalMana, hybridChoices: choices };
}

/** Can this pool alone pay this concrete problem? Generic takes anything. */
export function poolCovers(pool: ManaPool, p: ConcreteProblem): boolean {
  let spare = 0;
  for (const c of COLORS) {
    if (pool[c] < p.colored[c]) return false;
    spare += pool[c] - p.colored[c];
  }
  if (pool.C < p.colorless) return false;
  spare += pool.C - p.colorless;
  return spare >= p.generic;
}

/** The exact pool spend for a concrete problem, or null if the pool cannot pay. */
export function spendFromPool(pool: ManaPool, p: ConcreteProblem): ManaPool | null {
  if (!poolCovers(pool, p)) return null;
  const spend: Record<ManaSymbolKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const c of COLORS) spend[c] = p.colored[c];
  spend.C = p.colorless;
  let generic = p.generic;
  // Spend the most plentiful surplus first, so a pool of {G}{G}{U} paying {1}
  // keeps the {U} that a later spell in the same step might need.
  const order: ManaSymbolKey[] = ['C', 'W', 'U', 'B', 'R', 'G'];
  order.sort((a, b) => pool[b] - spend[b] - (pool[a] - spend[a]));
  for (const k of order) {
    if (generic <= 0) break;
    const avail = pool[k] - spend[k];
    const take = Math.min(avail, generic);
    spend[k] += take;
    generic -= take;
  }
  if (generic > 0) return null;
  return { ...spend };
}

export function poolAsPool(spend: Record<ManaSymbolKey, number>): ManaPool {
  return { W: spend.W, U: spend.U, B: spend.B, R: spend.R, G: spend.G, C: spend.C };
}

export { EMPTY_POOL, poolTotal };
