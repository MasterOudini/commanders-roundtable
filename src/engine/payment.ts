// The auto-tap solver: three tiers, escalating only when needed.
//
//   Tier A  necessary-condition filter, O(|S| · 6). This is what `legalActions`
//           runs on EVERY card in hand at EVERY priority grant to decide whether
//           to grey it out, so it has to be trivially cheap and never wrong in
//           the "affordable" direction.
//   Tier B  greedy "spend the least flexible source first". Settles ~95% of real
//           boards, and produces a *sensible* plan rather than merely a legal
//           one — it hoards Command Tower and leaves mana dorks untapped.
//   Tier C  min-cost max-flow, only when greedy fails.
//
// ⚠️ Tier B is not a shortcut around Tier C; it is a different objective.
// Max-flow finds *a* feasible assignment. A player wants the one that keeps
// their options open, which is what the greedy ordering and the flow's cost
// function both encode.

import type { DeriveCache } from './derive';
import {
  colorsOf,
  hybridCombinations,
  manaSourcesOf,
  maxAmount,
  poolCovers,
  spendFromPool,
  type ConcreteProblem,
  type ManaSource,
} from './mana';
import type { ScriptRegistry } from './scripts/registry';
import type { InstanceId, PlayerId } from './types/ids';
import {
  COLORS,
  EMPTY_POOL,
  type ManaPool,
  type ManaSymbolKey,
  type PaymentPlan,
  type PaymentProblem,
  type PlannedTap,
} from './types/mana';
import type { ManaOutput, OracleDb } from './types/oracle';
import type { GameState } from './types/state';

const KEYS: readonly ManaSymbolKey[] = ['W', 'U', 'B', 'R', 'G', 'C'];

/** Everything the solver needs, decoupled from GameState so it can run client-side. */
export interface SolveInput {
  readonly pool: ManaPool;
  readonly sources: readonly ManaSource[];
  readonly lifeAvailable: number;
  readonly eventCount: number;
}

export function solveInputFor(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
  cache?: DeriveCache,
): SolveInput {
  const p = state.players[player];
  return {
    pool: p?.pool ?? EMPTY_POOL,
    sources: manaSourcesOf(state, oracle, scripts, player, cache ? { cache } : {}),
    lifeAvailable: p?.life ?? 0,
    eventCount: state.eventCount,
  };
}

// ── Tier A ───────────────────────────────────────────────────────────────────

/**
 * The necessary-condition filter. Cheap, and never says "no" to something that
 * is actually payable — a false negative here greys out a castable card, which
 * is the single most infuriating bug an auto-tapper can have.
 *
 * It CAN say "yes" to something unpayable (two sources that each make W or U
 * cannot pay {W}{W}{U}); Tier B or C then finds that out.
 */
export function tierAFeasible(input: SolveInput, p: ConcreteProblem): boolean {
  if (p.lifeCost >= input.lifeAvailable) return false;
  let available = 0;
  for (const k of KEYS) available += input.pool[k];
  for (const s of input.sources) available += maxAmount(s);
  if (available < p.totalMana) return false;

  for (const c of COLORS) {
    const need = p.colored[c];
    if (need === 0) continue;
    let have = input.pool[c];
    for (const s of input.sources) {
      let best = 0;
      for (const o of s.outputs) best = Math.max(best, o.mana[c]);
      have += best;
      if (have >= need) break;
    }
    if (have < need) return false;
  }
  if (p.colorless > 0) {
    let have = input.pool.C;
    for (const s of input.sources) {
      let best = 0;
      for (const o of s.outputs) best = Math.max(best, o.mana.C);
      have += best;
      if (have >= p.colorless) break;
    }
    if (have < p.colorless) return false;
  }
  return true;
}

/**
 * Can this player afford this cost at all?
 *
 * ⚠️ Memoised on `state.eventCount` by the caller (`legalActions`), so a whole
 * priority round over a 7-card hand costs one build of the source list rather
 * than seven.
 */
export function affordable(input: SolveInput, problem: PaymentProblem): boolean {
  for (const concrete of hybridCombinations(problem)) {
    if (tierAFeasible(input, concrete)) return true;
  }
  return false;
}

// ── the plan ─────────────────────────────────────────────────────────────────

interface Working {
  /** Mana produced by taps so far, not yet allocated. */
  surplus: Record<ManaSymbolKey, number>;
  taps: PlannedTap[];
  used: Set<InstanceId>;
}

function emptyWorking(): Working {
  return { surplus: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, taps: [], used: new Set() };
}

/**
 * Suggest a payment, or null if the board cannot pay.
 *
 * `null` is not an error — it is the answer to "can I cast this", and callers
 * turn it into `'cannotAfford'` with the cost in the message.
 */
export function suggestPayment(input: SolveInput, problem: PaymentProblem): PaymentPlan | null {
  for (const concrete of hybridCombinations(problem)) {
    if (!tierAFeasible(input, concrete)) continue;
    const greedy = solveGreedy(input, concrete);
    if (greedy) return finish(input, concrete, greedy);
    const flow = solveFlow(input, concrete);
    if (flow) return finish(input, concrete, flow);
  }
  return null;
}

function finish(input: SolveInput, concrete: ConcreteProblem, w: Working): PaymentPlan {
  // Whatever the pool already held is spent before anything is tapped: it is
  // free, and it empties at the end of the step anyway.
  const total: Record<ManaSymbolKey, number> = { ...w.surplus };
  for (const k of KEYS) total[k] += input.pool[k];
  const spend = spendFromPool(total as ManaPool, concrete);
  return {
    taps: w.taps,
    spendFromPool: spend ?? EMPTY_POOL,
    hybridChoices: concrete.hybridChoices,
    lifePaid: concrete.lifeCost,
    forEventCount: input.eventCount,
  };
}

// ── Tier B: greedy ───────────────────────────────────────────────────────────

function solveGreedy(input: SolveInput, p: ConcreteProblem): Working | null {
  const w = emptyWorking();
  for (const k of KEYS) w.surplus[k] = input.pool[k];

  const candidates = [...input.sources].sort(
    (a, b) => a.flexibilityRank - b.flexibilityRank || a.outputs.length - b.outputs.length,
  );

  // Coloured requirements first, scarcest colour first: the colour with fewest
  // capable sources has the least room to be wrong about.
  const needs: { key: ManaSymbolKey; count: number }[] = [];
  for (const c of COLORS) if (p.colored[c] > 0) needs.push({ key: c, count: p.colored[c] });
  if (p.colorless > 0) needs.push({ key: 'C', count: p.colorless });
  const scarcity = new Map<ManaSymbolKey, number>();
  for (const n of needs) {
    scarcity.set(n.key, candidates.filter((s) => colorsOf(s).has(n.key)).length);
  }
  needs.sort((a, b) => (scarcity.get(a.key) ?? 0) - (scarcity.get(b.key) ?? 0));

  for (const need of needs) {
    let remaining = need.count - w.surplus[need.key];
    while (remaining > 0) {
      const pick = pickSource(candidates, w, need.key);
      if (!pick) return null;
      tap(w, pick.source, pick.outputIndex);
      remaining = need.count - w.surplus[need.key];
    }
  }

  // Generic last, from whatever is left — still least-flexible first.
  let generic = p.generic;
  let spare = 0;
  for (const c of COLORS) spare += Math.max(0, w.surplus[c] - p.colored[c]);
  spare += Math.max(0, w.surplus.C - p.colorless);
  while (spare < generic) {
    const pick = pickAny(candidates, w);
    if (!pick) return null;
    const before = totalSurplus(w);
    tap(w, pick.source, pick.outputIndex);
    spare += totalSurplus(w) - before;
  }
  generic = 0;

  return poolCovers(w.surplus as ManaPool, p) ? w : null;
}

function totalSurplus(w: Working): number {
  let n = 0;
  for (const k of KEYS) n += w.surplus[k];
  return n;
}

function pickSource(
  candidates: readonly ManaSource[],
  w: Working,
  key: ManaSymbolKey,
): { source: ManaSource; outputIndex: number } | null {
  for (const source of candidates) {
    if (w.used.has(source.card)) continue;
    // Prefer the output that produces the LEAST extra beyond what is needed,
    // so a dual land asked for {U} does not get committed to its other half.
    let bestIndex = -1;
    let bestWaste = Number.POSITIVE_INFINITY;
    for (let i = 0; i < source.outputs.length; i++) {
      const o = source.outputs[i];
      if (!o || o.mana[key] <= 0) continue;
      const waste = o.amount - o.mana[key];
      if (waste < bestWaste) {
        bestWaste = waste;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) return { source, outputIndex: bestIndex };
  }
  return null;
}

function pickAny(
  candidates: readonly ManaSource[],
  w: Working,
): { source: ManaSource; outputIndex: number } | null {
  for (const source of candidates) {
    if (w.used.has(source.card)) continue;
    let bestIndex = -1;
    let bestAmount = -1;
    for (let i = 0; i < source.outputs.length; i++) {
      const o = source.outputs[i];
      if (!o) continue;
      if (o.amount > bestAmount) {
        bestAmount = o.amount;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) return { source, outputIndex: bestIndex };
  }
  return null;
}

function tap(w: Working, source: ManaSource, outputIndex: number): void {
  const output = source.outputs[outputIndex];
  if (!output) return;
  // ⚠️ ONE TAP PER PERMANENT, across all of its abilities. Tundra has two
  // separate mana abilities (one per land type); without this the solver would
  // happily "tap" it for W and again for U, and the payment would be rejected
  // by the host with a message the player cannot act on.
  w.used.add(source.card);
  w.taps.push({ source: source.card, abilityIndex: source.abilityIndex, outputChoice: outputIndex });
  for (const k of KEYS) w.surplus[k] += output.mana[k];
}

// ── Tier C: min-cost max-flow ────────────────────────────────────────────────
//
// Node layout:
//   0                       super-source
//   1 .. n                  one per mana source
//   n+1 .. n+6              one per colour (W U B R G C)
//   n+7 .. n+12             one requirement node per colour
//   n+13                    generic
//   n+14                    sink
//
// ⚠️ EXACTNESS CAVEAT, stated rather than hidden. A source is modelled as a
// node whose capacity is its largest output, with an edge to each colour it can
// make. That is EXACT whenever every output of the source produces one mana
// (duals, Command Tower, mana dorks — i.e. essentially every multi-output
// source in Magic), because a capacity of 1 forces a single colour. It is
// over-permissive only for a source that has several outputs AND at least one
// output of 2+ mana. `splitAwkward` detects exactly those and enumerates their
// outputs explicitly before the flow runs, so the model the solver sees is
// always exact.

interface Edge {
  to: number;
  cap: number;
  cost: number;
  rev: number;
}

class MinCostFlow {
  private readonly graph: Edge[][];

  constructor(readonly n: number) {
    this.graph = Array.from({ length: n }, () => [] as Edge[]);
  }

  add(from: number, to: number, cap: number, cost: number): void {
    const a = this.graph[from];
    const b = this.graph[to];
    if (!a || !b) return;
    a.push({ to, cap, cost, rev: b.length });
    b.push({ to: from, cap: 0, cost: -cost, rev: a.length - 1 });
  }

  /** SPFA-based successive shortest paths. Returns the flow pushed. */
  run(s: number, t: number, maxFlow: number): number {
    let flow = 0;
    while (flow < maxFlow) {
      const dist = new Array<number>(this.n).fill(Number.POSITIVE_INFINITY);
      const inQueue = new Array<boolean>(this.n).fill(false);
      const prevNode = new Array<number>(this.n).fill(-1);
      const prevEdge = new Array<number>(this.n).fill(-1);
      dist[s] = 0;
      const queue: number[] = [s];
      inQueue[s] = true;
      while (queue.length > 0) {
        const v = queue.shift() as number;
        inQueue[v] = false;
        const edges = this.graph[v] ?? [];
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i] as Edge;
          if (e.cap <= 0) continue;
          const nd = (dist[v] as number) + e.cost;
          if (nd < (dist[e.to] as number) - 1e-9) {
            dist[e.to] = nd;
            prevNode[e.to] = v;
            prevEdge[e.to] = i;
            if (!inQueue[e.to]) {
              inQueue[e.to] = true;
              queue.push(e.to);
            }
          }
        }
      }
      if (!Number.isFinite(dist[t] as number)) break;
      let push = maxFlow - flow;
      for (let v = t; v !== s; v = prevNode[v] as number) {
        const e = (this.graph[prevNode[v] as number] as Edge[])[prevEdge[v] as number] as Edge;
        push = Math.min(push, e.cap);
      }
      for (let v = t; v !== s; v = prevNode[v] as number) {
        const edges = this.graph[prevNode[v] as number] as Edge[];
        const e = edges[prevEdge[v] as number] as Edge;
        e.cap -= push;
        const back = (this.graph[e.to] as Edge[])[e.rev] as Edge;
        back.cap += push;
      }
      flow += push;
    }
    return flow;
  }

  edgesFrom(v: number): readonly Edge[] {
    return this.graph[v] ?? [];
  }
}

/** A source whose outputs cannot be summarised by "max per colour". */
function splitAwkward(sources: readonly ManaSource[]): ManaSource[] {
  const out: ManaSource[] = [];
  for (const s of sources) {
    const multiOutput = s.outputs.length > 1;
    const anyBig = s.outputs.some((o) => o.amount > 1);
    if (!multiOutput || !anyBig) {
      out.push(s);
      continue;
    }
    // Enumerate. Rare enough that the combinatorics never matter, and the
    // alternative is a plan the host would reject.
    for (const o of s.outputs) out.push({ ...s, outputs: [o] });
  }
  return out;
}

/**
 * Exported for `payment.bench.test.ts` only.
 *
 * The spec's complexity claim ("well under 1 ms at |S| ≤ 40") is worth
 * measuring rather than asserting, and measuring it through `suggestPayment`
 * would time the greedy tier instead — which settles almost everything and
 * would make the benchmark quietly meaningless.
 */
export function solveFlowForBenchmark(input: SolveInput, p: ConcreteProblem): unknown {
  return solveFlow(input, p);
}

function solveFlow(input: SolveInput, p: ConcreteProblem): Working | null {
  const sources = splitAwkward(input.sources);
  // The same physical permanent may now appear several times (one entry per
  // output). Only one of them may be chosen, which the "used" set enforces
  // after the flow — and the flow is re-run without a rejected duplicate.
  const n = sources.length;
  const S = 0;
  const src = (i: number): number => 1 + i;
  const colorNode = (k: number): number => 1 + n + k;
  const reqNode = (k: number): number => 1 + n + 6 + k;
  const GENERIC = 1 + n + 12;
  const T = 1 + n + 13;

  const need: number[] = [p.colored.W, p.colored.U, p.colored.B, p.colored.R, p.colored.G, p.colorless];
  const required = need.reduce((a, b) => a + b, 0) + p.generic;
  if (required === 0) return emptyWorkingWith(input);

  const mcmf = new MinCostFlow(T + 1);
  // The pool is free mana already in hand: model it as a zero-cost injection
  // straight into its colour node, so the flow spends it before tapping.
  for (let k = 0; k < 6; k++) {
    const key = KEYS[k] as ManaSymbolKey;
    if (input.pool[key] > 0) mcmf.add(S, colorNode(k), input.pool[key], 0);
  }
  const srcEdgeIndex: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = sources[i] as ManaSource;
    srcEdgeIndex.push(mcmf.edgesFrom(S).length);
    mcmf.add(S, src(i), maxAmount(s), 0);
    for (let k = 0; k < 6; k++) {
      const key = KEYS[k] as ManaSymbolKey;
      let best = 0;
      for (const o of s.outputs) best = Math.max(best, o.mana[key]);
      if (best <= 0) continue;
      // w(s,c) = |O_s| + flexibilityRank(s) + (creature ? 4 : 0). The creature
      // term is folded into flexibilityRank (6 for a creature), which is the
      // same intent with one fewer lookup.
      mcmf.add(src(i), colorNode(k), best, s.outputs.length + s.flexibilityRank);
    }
  }
  for (let k = 0; k < 6; k++) {
    if ((need[k] as number) > 0) {
      mcmf.add(colorNode(k), reqNode(k), need[k] as number, 0);
      mcmf.add(reqNode(k), T, need[k] as number, 0);
    }
    if (p.generic > 0) mcmf.add(colorNode(k), GENERIC, p.generic, 1);
  }
  if (p.generic > 0) mcmf.add(GENERIC, T, p.generic, 0);

  const pushed = mcmf.run(S, T, required);
  if (pushed < required) return null;

  // Read the taps back off the residual capacities.
  const w = emptyWorking();
  for (const k of KEYS) w.surplus[k] = input.pool[k];
  for (let i = 0; i < n; i++) {
    const s = sources[i] as ManaSource;
    const edges = mcmf.edgesFrom(src(i));
    const usedColors: ManaSymbolKey[] = [];
    for (const e of edges) {
      if (e.to < colorNode(0) || e.to > colorNode(5)) continue;
      const k = e.to - colorNode(0);
      // Forward edges lose capacity as flow passes; a residual below its
      // original means this source fed that colour.
      let original = 0;
      for (const o of s.outputs) original = Math.max(original, o.mana[KEYS[k] as ManaSymbolKey]);
      if (e.cap < original) usedColors.push(KEYS[k] as ManaSymbolKey);
    }
    if (usedColors.length === 0) continue;
    if (w.used.has(s.card)) continue;
    const outputIndex = bestOutputFor(s.outputs, usedColors);
    if (outputIndex < 0) continue;
    tap(w, s, outputIndex);
  }

  return poolCovers(w.surplus as ManaPool, p) ? w : null;
}

function emptyWorkingWith(input: SolveInput): Working {
  const w = emptyWorking();
  for (const k of KEYS) w.surplus[k] = input.pool[k];
  return w;
}

function bestOutputFor(outputs: readonly ManaOutput[], want: readonly ManaSymbolKey[]): number {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < outputs.length; i++) {
    const o = outputs[i];
    if (!o) continue;
    let score = 0;
    for (const k of want) score += o.mana[k];
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return bestScore > 0 ? best : -1;
}

// ── validation, host-side ────────────────────────────────────────────────────

export type PlanProblem = 'stale' | 'invalid' | null;

/**
 * Re-check a client's plan against real state.
 *
 * ⚠️ The staleness check is on `eventCount`, not on a timestamp. A plan built
 * two events ago against an identical board is fine; a plan built one event ago
 * against a board that has since lost a land is not, and only the board can
 * tell you which.
 */
export function validatePlan(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
  problem: PaymentProblem,
  plan: PaymentPlan,
): PlanProblem {
  const sources = manaSourcesOf(state, oracle, scripts, player, { includeConditional: true });
  const byCard = new Map<string, ManaSource[]>();
  for (const s of sources) byCard.set(s.card, [...(byCard.get(s.card) ?? []), s]);

  const seen = new Set<InstanceId>();
  const produced: Record<ManaSymbolKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const tapPlan of plan.taps) {
    if (seen.has(tapPlan.source)) return 'invalid';
    seen.add(tapPlan.source);
    const options = byCard.get(tapPlan.source);
    const source = options?.find((s) => s.abilityIndex === tapPlan.abilityIndex);
    if (!source) return plan.forEventCount === state.eventCount ? 'invalid' : 'stale';
    const output = source.outputs[tapPlan.outputChoice];
    if (!output) return 'invalid';
    for (const k of KEYS) produced[k] += output.mana[k];
  }

  const p = state.players[player];
  if (!p) return 'invalid';
  const total: Record<ManaSymbolKey, number> = { ...produced };
  for (const k of KEYS) total[k] += p.pool[k];

  const concrete = hybridCombinations(problem).find(
    (c) =>
      c.hybridChoices.length === plan.hybridChoices.length &&
      c.hybridChoices.every((h, i) => plan.hybridChoices[i]?.option === h.option),
  );
  if (!concrete) return 'invalid';
  if (concrete.lifeCost !== plan.lifePaid) return 'invalid';
  if (concrete.lifeCost >= p.life) return 'invalid';
  if (!poolCovers(total as ManaPool, concrete)) {
    return plan.forEventCount === state.eventCount ? 'invalid' : 'stale';
  }
  return null;
}

/** The exact mana a validated plan takes out of the pool once its taps land. */
export function spendForPlan(
  pool: ManaPool,
  produced: ManaPool,
  concrete: ConcreteProblem,
): ManaPool | null {
  const total: Record<ManaSymbolKey, number> = { ...pool };
  for (const k of KEYS) total[k] += produced[k];
  return spendFromPool(total as ManaPool, concrete);
}
