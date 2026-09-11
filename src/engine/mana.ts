// Mana sources on the board, and turning a cost into a payment problem.

import type { ColorLetter } from '../data/cardTypes';
import { derive, type DeriveCache } from './derive';
import type { ScriptRegistry } from './scripts/registry';
import type { InstanceId, PlayerId } from './types/ids';
import {
  COLORS,
  EMPTY_POOL,
  MANA_KEYS,
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
import type { ManaOutput, ManaProduction, OracleDb } from './types/oracle';
import type { GameState } from './types/state';
import { faceColors, fitPool, type SpendPurpose } from './spend';
import type { SpendRestriction } from './types/mana';
import { faceOf } from './oracle';

/** One tappable mana ability, with its `anyColor` already expanded. */
export interface ManaSource {
  readonly card: InstanceId;
  readonly abilityIndex: number;
  readonly outputs: readonly ManaOutput[];
  readonly requiresTap: boolean;
  readonly conditional: boolean;
  /** D325 - the cost beside the {T} the tap charges; absent or null for a plain source. */
  readonly extraCost?: ManaProduction['extraCost'];
  /** D355 - the price the line charges when the mana is made. */
  readonly drawback?: ManaProduction['drawback'];
  /**
   * D364 - is this a SNOW SOURCE (CR 107.4s)? A permanent with the Snow supertype,
   * read DERIVED rather than printed, because a permanent can be made snow.
   * `{S}` is paid by mana from one of these, of any colour.
   */
  readonly snow: boolean;
  /**
   * D397 - the SPEND RESTRICTION the line prints and the engine read, or null. A
   * source whose restriction the purpose does not fit is dropped by `fitFor` before
   * the solver sees it; one it fits ranks below a basic land, so the solver spends
   * the mana that can do the least first.
   */
  readonly restriction: SpendRestriction | null;
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
 * One mana output as a Scryfall cost string: `{G}`, `{C}{C}`, `{W}{U}`.
 *
 * ⚠️ This is what "what will this land bring me" is written in, and it is a
 * STRING rather than the pool it came from because the answer travels: it goes
 * into every `TapForMana` legal action, over the wire to every guest, and
 * straight into `<ManaCost>`, which reads exactly this shape. Six numeric keys
 * per output, repeated per source per frame, would be the same fact in a form
 * nothing at either end wants.
 *
 * ⚠️ WUBRG then C — the printed order, so two lands never disagree about which
 * way round `{W}{U}` reads.
 */
export function costStringOf(mana: ManaPool): string {
  let out = '';
  for (const key of MANA_KEYS) out += `{${key}}`.repeat(mana[key]);
  return out;
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
  opts: { includeConditional?: boolean; includeTapped?: boolean; includeCostly?: boolean; cache?: DeriveCache } = {},
): ManaSource[] {
  const identity = state.players[player]?.identity ?? [];
  // ⚠️ TWO PASSES, because a land can be defined by the other lands. Reflecting
  // Pool makes "any type that a land you control could produce" and Exotic
  // Orchard what an opponent's lands do, so those two sets have to be known
  // before any dynamic source is expanded.
  //
  // ⚠️ The sets are built from CONCRETE outputs only — a source whose own scope
  // is dynamic contributes nothing to them. That is the recursion guard, and it
  // is also the rule: two Reflecting Pools and nothing else genuinely produce no
  // mana, because neither can name a colour the other could make.
  const landColours = boardColours(state, oracle, scripts, opts.cache);
  const out: ManaSource[] = [];
  for (const id of state.zones.battlefield) {
    const card = state.cards[id];
    if (!card || card.controller !== player) continue;
    if (card.phasedOut) continue;
    const d = derive(state, oracle, scripts, id, opts.cache);
    for (const prod of d.producesMana) {
      if (prod.conditional && !opts.includeConditional) continue;
      // D325 - a source with a cost beside the {T} is never auto-tapped (the solver would have
      // to price mana against mana); the tap-by-hand menu and the handler ask for it by name.
      if (prod.extraCost && !opts.includeCostly) continue;
      if (prod.requiresTap && card.tapped && !opts.includeTapped) continue;
      // Summoning sickness stops a creature using a {T} ability. CR 302.6 —
      // and it is the single most common "why can't I tap this" question.
      if (prod.requiresTap && d.isCreature && !canTapForAbility(state, card.id, d)) continue;
      const scoped =
        prod.anyColor?.scope === 'landsYou'
          ? (landColours.get(player) ?? [])
          : prod.anyColor?.scope === 'landsOpponents'
            ? opponentColours(state, player, landColours)
            : // ⚠️ THE PERMANENT'S OWN ANSWER (D147). A set of one, and EMPTY
              // until the "as this enters, choose a color" prompt is answered —
              // at which point `expandOutputs` yields nothing and the source is
              // skipped below. That is the honest state: a Sol Grail whose
              // colour nobody has named makes no mana, which is what the card
              // says.
              prod.anyColor?.scope === 'chosen'
              ? (card.chosenColor === null ? [] : [card.chosenColor])
              : // D397 - the legendary scopes, off the board and the graveyard as they stand.
                prod.anyColor?.scope === 'legendaryYou'
                ? legendaryColours(state, oracle, scripts, player, 'permanents', opts.cache)
                : prod.anyColor?.scope === 'legendaryCreaturesWalkersYou'
                  ? legendaryColours(state, oracle, scripts, player, 'creaturesWalkers', opts.cache)
                  : prod.anyColor?.scope === 'legendaryGraveyard'
                    ? graveyardLegendaryCreatureColours(state, oracle, player)
                    : identity;
      const outputs = expandOutputs(prod.outputs, prod.anyColor, scoped);
      if (outputs.length === 0) continue;
      out.push({
        card: id,
        abilityIndex: prod.abilityIndex,
        outputs,
        // D364 - DERIVED, never printed: a permanent made snow is a snow source.
        snow: d.typeLine.supertypes.includes('Snow'),
        requiresTap: prod.requiresTap,
        conditional: prod.conditional,
        extraCost: prod.extraCost ?? null,
        // D355 - the price the line charges when the mana is made, carried to the handler that
        // charges it. A production with no price passes null, which is what every source but the
        // painlands and the Talismans is.
        drawback: prod.drawback ?? null,
        // D397 - the restriction the line prints, carried to the payment path that enforces it.
        restriction: prod.restriction ?? null,
        // D397 - a restricted source is less flexible than anything unrestricted: below a basic.
        flexibilityRank: rankOf(d, outputs) - (prod.restriction ? 1 : 0),
      });
    }
  }
  return out;
}

/**
 * What each player's LANDS could produce, from their concrete outputs alone.
 *
 * ⚠️ Lands, not permanents: "a land you control could produce" says so, and a
 * Birds of Paradise is not a land. ⚠️ And concrete outputs only — a dynamic
 * source contributes nothing, which is what stops Reflecting Pool asking
 * Reflecting Pool. Tapped lands still count: the card asks what a land COULD
 * produce, not what it can produce right now.
 */
function boardColours(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  cache?: DeriveCache,
): Map<PlayerId, Color[]> {
  const byPlayer = new Map<PlayerId, Set<Color>>();
  for (const id of state.zones.battlefield) {
    const card = state.cards[id];
    if (!card || card.phasedOut) continue;
    const d = derive(state, oracle, scripts, id, cache);
    if (!d.isLand) continue;
    for (const prod of d.producesMana) {
      if (prod.anyColor) continue;
      for (const output of prod.outputs) {
        for (const colour of COLORS) {
          if (output.mana[colour] > 0) {
            let set = byPlayer.get(card.controller);
            if (!set) {
              set = new Set<Color>();
              byPlayer.set(card.controller, set);
            }
            set.add(colour);
          }
        }
      }
    }
  }
  const out = new Map<PlayerId, Color[]>();
  for (const [p, set] of byPlayer) out.set(p, COLORS.filter((c) => set.has(c)));
  return out;
}

/**
 * D397 - the colours of the legendary permanents a player controls (Plaza of Heroes), or of
 * their legendary creatures and planeswalkers alone (Mox Amber), read DERIVED - a permanent
 * made legendary, or recoloured, counts as the board has it. Empty when there is none, which
 * is what the card says.
 */
function legendaryColours(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
  which: 'permanents' | 'creaturesWalkers',
  cache?: DeriveCache,
): Color[] {
  const set = new Set<Color>();
  for (const id of state.zones.battlefield) {
    const card = state.cards[id];
    if (!card || card.phasedOut || card.controller !== player) continue;
    const d = derive(state, oracle, scripts, id, cache);
    if (!d.typeLine.supertypes.includes('Legendary')) continue;
    if (which === 'creaturesWalkers' && !d.typeLine.types.includes('Creature') && !d.typeLine.types.includes('Planeswalker')) continue;
    for (const c of d.colors) set.add(c);
  }
  return COLORS.filter((c) => set.has(c));
}

/**
 * D397 - the colours of the legendary creature CARDS in a player's graveyard (The Grey Havens),
 * read off the printed faces - a card in a graveyard has no battlefield derivation (D171) -
 * with devoid honoured as `spellPurpose` honours it.
 */
function graveyardLegendaryCreatureColours(state: GameState, oracle: OracleDb, player: PlayerId): Color[] {
  const set = new Set<Color>();
  for (const id of state.zones.graveyard[player] ?? []) {
    const inst = state.cards[id];
    if (!inst) continue;
    const oc = oracle.byPrinting(inst.printingId);
    if (!oc) continue;
    const face = faceOf(oc, inst.faceIndex);
    if (!face.typeLine.supertypes.includes('Legendary') || !face.typeLine.types.includes('Creature')) continue;
    for (const c of faceColors(face)) set.add(c);
  }
  return COLORS.filter((c) => set.has(c));
}

/** The union over everyone else — Exotic Orchard reads every opponent, not one. */
function opponentColours(
  state: GameState,
  player: PlayerId,
  landColours: Map<PlayerId, Color[]>,
): Color[] {
  const seen = new Set<Color>();
  for (const [p, colours] of landColours) {
    if (p === player) continue;
    if (state.players[p]?.hasLost) continue;
    for (const c of colours) seen.add(c);
  }
  return COLORS.filter((c) => seen.has(c));
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
  anyColor: ManaProduction['anyColor'],
  /**
   * The colours this particular scope resolves to. `all` ignores it; every other
   * scope has already been worked out by the caller, which is the only place
   * that can see the board.
   */
  scoped: readonly ColorLetter[],
): ManaOutput[] {
  if (!anyColor) return [...outputs];
  const colors: readonly Color[] = anyColor.scope === 'all' ? COLORS : (scoped as readonly Color[]);
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
  let snow = 0;
  const hybrids: HybridRequirement[] = [];

  const fold = (cost: ManaCost | null): void => {
    if (!cost) return;
    for (const c of COLORS) colored[c] += cost.colored[c];
    colorless += cost.colorless;
    // ⚠️ D363 - `cost.snow` is NOT folded in here any more. `{S}` is one mana from a
    // SNOW SOURCE (CR 107.4s), and adding it to the generic requirement charged it as
    // ordinary mana - Arcum’s Astrolabe castable off a Mountain. It rides its own
    // field until the engine has a snow-source concept to satisfy it with.
    generic += cost.generic + cost.xCount * Math.max(0, xValue);
    snow += cost.snow;
    for (const h of cost.hybrids) hybrids.push({ index: hybrids.length, options: h.options });
  };

  fold(base);
  for (const extra of additional) fold(extra);
  // D312 - a cost reduction rides on the same generic adjustment the commander
  // tax does (a negative one); it can empty the generic part, never go below
  // it (CR 601.2f: reductions apply to the generic component only).
  generic = Math.max(0, generic);

  let totalMana = colorless + generic;
  for (const c of COLORS) totalMana += colored[c];
  for (const h of hybrids) totalMana += minManaFor(h.options);

  return { colored, colorless, generic, snow, hybrids, additionalLife, totalMana };
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
  /**
   * D364 - how many of the mana paid must come from a SNOW SOURCE. It is a
   * QUANTITY like generic (so `poolCovers` and `spendFromPool` count it) plus a
   * constraint on WHERE that mana came from, which the payment reserves.
   */
  readonly snow: number;
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
  // ⚠️ D363/D364 - the snow requirement is NOT generic (see `buildPaymentProblem`):
  // it is one mana that must come from a SNOW SOURCE, so it rides its own field and
  // the payment reserves it before the solver ever sees the rest.
  let generic = problem.generic;
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
  // D364 - a snow symbol is one mana like any other, so it counts toward the
  // QUANTITY; what is special is only where that mana must come from.
  let totalMana = colorless + generic + problem.snow;
  for (const c of COLORS) totalMana += colored[c];
  return { colored, colorless, generic, snow: problem.snow, lifeCost, totalMana, hybridChoices: choices };
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
  // D364 - the snow symbols are a QUANTITY here; that the mana is snow-sourced is
  // the reservation's job, not this one's.
  return spare >= p.generic + p.snow;
}

/** The exact pool spend for a concrete problem, or null if the pool cannot pay. */
export function spendFromPool(pool: ManaPool, p: ConcreteProblem): ManaPool | null {
  if (!poolCovers(pool, p)) return null;
  const spend: Record<ManaSymbolKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const c of COLORS) spend[c] = p.colored[c];
  spend.C = p.colorless;
  // D364 - the snow symbols spend like generic; `payEvents` then says which of the
  // spend was snow-sourced, and the reservation guaranteed that much is there.
  let generic = p.generic + p.snow;
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

/**
 * D325 - can the player pay a mana ability's cost beside the {T} right now, and
 * with what? The mana comes out of the POOL (a Signet needs its {1} floating
 * first - the solver never prices mana against mana), the life off the total
 * (a player may pay life they have, CR 119.4). Null when it cannot be paid.
 */
export function extraCostSpend(state: GameState, player: PlayerId, extra: NonNullable<ManaProduction['extraCost']>, purpose: SpendPurpose): { readonly mana: ManaPool | null; readonly life: number } | null {
  const me = state.players[player];
  if (!me) return null;
  if (extra.life > 0 && me.life < extra.life) return null;
  let mana: ManaPool | null = null;
  if (extra.mana) {
    const concrete = hybridCombinations(buildPaymentProblem(extra.mana, 0, [], 0, 0))[0];
    if (!concrete) return null;
    // D397 - a mana ability's own price is an ABILITY of its source: restricted mana that
    // fits that purpose pays it, mana that does not is not in the pool it draws on.
    const spend = spendFromPool(fitPool(me.pool, me.poolRestricted, purpose), concrete);
    if (!spend) return null;
    mana = spend;
  }
  return { mana, life: extra.life };
}

export { EMPTY_POOL, poolTotal };
