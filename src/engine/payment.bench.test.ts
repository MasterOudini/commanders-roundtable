import { describe, expect, test } from 'vitest';
import { hybridCombinations, buildPaymentProblem, type ManaSource } from './mana';
import { solveFlowForBenchmark, type SolveInput } from './payment';
import { parseManaCost } from '../data/oracleParse';
import { EMPTY_POOL, poolFrom } from './types/mana';

// The spec claims Tier C is "well under 1 ms in JS" at |S| ≤ 40 with V ≤ 64 and
// E ≤ 340. That is a claim worth MEASURING rather than asserting: a min-cost
// max-flow with a bad augmenting-path choice is quadratically slower, and the
// difference only shows on a board nobody builds until turn nine.
//
// ⚠️ Measured through `solveFlowForBenchmark`, not `suggestPayment`. The greedy
// tier settles this board instantly, so timing the public entry point would
// benchmark the tier that is NOT under test and report a reassuring number.
//
// ⚠️ `performance.now()` is banned inside `src/engine/` (purity.test.ts) — but
// this is a TEST, which is not shipped, and timing is the whole point.

/** A synthetic 40-source board: basics, duals, any-colour lands, mana dorks. */
function board(count: number): ManaSource[] {
  const colors = ['W', 'U', 'B', 'R', 'G'] as const;
  const out: ManaSource[] = [];
  for (let i = 0; i < count; i++) {
    const c = colors[i % 5] as (typeof colors)[number];
    const d = colors[(i + 2) % 5] as (typeof colors)[number];
    if (i % 4 === 0) {
      out.push({
        card: `c${i}`,
        abilityIndex: 0,
        outputs: [{ mana: poolFrom({ [c]: 1 }), amount: 1 }],
        requiresTap: true,
        conditional: false,
        flexibilityRank: 0,
      });
    } else if (i % 4 === 1) {
      out.push({
        card: `c${i}`,
        abilityIndex: 0,
        outputs: [
          { mana: poolFrom({ [c]: 1 }), amount: 1 },
          { mana: poolFrom({ [d]: 1 }), amount: 1 },
        ],
        requiresTap: true,
        conditional: false,
        flexibilityRank: 2,
      });
    } else if (i % 4 === 2) {
      out.push({
        card: `c${i}`,
        abilityIndex: 0,
        outputs: colors.map((x) => ({ mana: poolFrom({ [x]: 1 }), amount: 1 })),
        requiresTap: true,
        conditional: false,
        flexibilityRank: 4,
      });
    } else {
      out.push({
        card: `c${i}`,
        abilityIndex: 0,
        outputs: [{ mana: poolFrom({ [c]: 1 }), amount: 1 }],
        requiresTap: true,
        conditional: false,
        flexibilityRank: 6,
      });
    }
  }
  return out;
}

function input(sources: ManaSource[]): SolveInput {
  return { pool: EMPTY_POOL, sources, lifeAvailable: 40, eventCount: 1 };
}

describe('the min-cost max-flow tier', () => {
  test('solves a 40-source board in well under 1 ms', () => {
    const sources = board(40);
    const problem = buildPaymentProblem(parseManaCost('{6}{W}{U}{B}{R}{G}'), 0, [], 0);
    const concrete = hybridCombinations(problem)[0];
    if (!concrete) throw new Error('no concrete problem');
    const inp = input(sources);

    // Warm up, so the number is steady-state rather than first-call JIT.
    for (let i = 0; i < 50; i++) solveFlowForBenchmark(inp, concrete);

    const runs = 500;
    const started = performance.now();
    for (let i = 0; i < runs; i++) solveFlowForBenchmark(inp, concrete);
    const perRun = (performance.now() - started) / runs;

    expect(solveFlowForBenchmark(inp, concrete)).not.toBeNull();
    // Reported either way, so a regression is visible even when it passes.
    // eslint-disable-next-line no-console
    console.log(`MCMF on 40 sources / 11 mana: ${perRun.toFixed(3)} ms per solve`);
    expect(perRun).toBeLessThan(1);
  });

  test('it also finds a solution greedy would miss', () => {
    // Two sources, each "W or U", paying {W}{U}. Greedy commits the first to W
    // and then has nothing for U if it picks badly; the flow always finds it.
    const sources: ManaSource[] = [
      {
        card: 'a',
        abilityIndex: 0,
        outputs: [
          { mana: poolFrom({ W: 1 }), amount: 1 },
          { mana: poolFrom({ U: 1 }), amount: 1 },
        ],
        requiresTap: true,
        conditional: false,
        flexibilityRank: 2,
      },
      {
        card: 'b',
        abilityIndex: 0,
        outputs: [
          { mana: poolFrom({ W: 1 }), amount: 1 },
          { mana: poolFrom({ U: 1 }), amount: 1 },
        ],
        requiresTap: true,
        conditional: false,
        flexibilityRank: 2,
      },
    ];
    const problem = buildPaymentProblem(parseManaCost('{W}{U}'), 0, [], 0);
    const concrete = hybridCombinations(problem)[0];
    if (!concrete) throw new Error('no concrete problem');
    expect(solveFlowForBenchmark(input(sources), concrete)).not.toBeNull();
  });

  test('an impossible cost returns null rather than a wrong plan', () => {
    const sources: ManaSource[] = [
      {
        card: 'a',
        abilityIndex: 0,
        outputs: [{ mana: poolFrom({ G: 1 }), amount: 1 }],
        requiresTap: true,
        conditional: false,
        flexibilityRank: 0,
      },
    ];
    const problem = buildPaymentProblem(parseManaCost('{U}{U}{U}'), 0, [], 0);
    const concrete = hybridCombinations(problem)[0];
    if (!concrete) throw new Error('no concrete problem');
    expect(solveFlowForBenchmark(input(sources), concrete)).toBeNull();
  });
});
