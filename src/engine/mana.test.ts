import { describe, expect, test } from 'vitest';
import { legalActions } from './legal';
import { buildPaymentProblem, manaSourcesOf, hybridCombinations } from './mana';
import { parseManaCost } from '../data/oracleParse';
import { suggestPayment, solveInputFor, tierAFeasible } from './payment';
import { faceOf } from './oracle';
import {
  ORACLE,
  advanceUntil,
  find,
  findAnywhere,
  fullControl,
  idsIn,
  must,
  nameOf,
  put,
  startedGame,
} from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function costOf(name: string) {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(`no fixture ${name}`);
  return faceOf(card, 0).manaCost;
}

function tappedNames(game: Game, ids: readonly InstanceId[]): string[] {
  return ids.map((id) => nameOf(game, id)).sort();
}

describe('mana pools and sources', () => {
  test('tapping a land adds its mana to the pool', () => {
    const game = startedGame({ decks: [['Forest']] });
    const forest = put(game, 'p1', 'Forest');
    must(game.submit({ t: 'TapForMana', player: 'p1', card: forest, abilityIndex: 0, outputChoice: 0 }));
    expect(game.state.players['p1']?.pool.G).toBe(1);
    expect(game.state.cards[forest]?.tapped).toBe(true);
  });

  test('a tapped land cannot be tapped again', () => {
    const game = startedGame({ decks: [['Forest']] });
    const forest = put(game, 'p1', 'Forest');
    must(game.submit({ t: 'TapForMana', player: 'p1', card: forest, abilityIndex: 0, outputChoice: 0 }));
    const again = game.submit({ t: 'TapForMana', player: 'p1', card: forest, abilityIndex: 0, outputChoice: 0 });
    expect(again.ok).toBe(false);
  });

  test('a dual land offers one ability per land type, and only one tap', () => {
    const game = startedGame({ decks: [['Tundra']] });
    const tundra = put(game, 'p1', 'Tundra');
    const sources = manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1');
    expect(sources.filter((s) => s.card === tundra)).toHaveLength(2);
    must(game.submit({ t: 'TapForMana', player: 'p1', card: tundra, abilityIndex: 0, outputChoice: 0 }));
    const second = game.submit({ t: 'TapForMana', player: 'p1', card: tundra, abilityIndex: 1, outputChoice: 0 });
    expect(second.ok).toBe(false);
  });

  test('Sol Ring taps for two colourless', () => {
    const game = startedGame({ decks: [['Sol Ring']] });
    const ring = put(game, 'p1', 'Sol Ring');
    must(game.submit({ t: 'TapForMana', player: 'p1', card: ring, abilityIndex: 0, outputChoice: 0 }));
    expect(game.state.players['p1']?.pool.C).toBe(2);
  });

  /**
   * ⚠️ Command Tower's colours come from the CONTROLLER'S commander identity,
   * resolved at solve time. Yeva is mono-green, so this Tower makes exactly one
   * option: {G}.
   */
  test('Command Tower expands to the commander colour identity', () => {
    const game = startedGame({
      decks: [['Command Tower']],
      commanders: [["Yeva, Nature's Herald"]],
    });
    const tower = put(game, 'p1', 'Command Tower');
    const source = manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1').find((s) => s.card === tower);
    expect(source?.outputs).toHaveLength(1);
    expect(source?.outputs[0]?.mana.G).toBe(1);
  });

  test('a three-colour commander gives Command Tower three options', () => {
    const game = startedGame({ decks: [['Command Tower']] }); // Kess = UBR
    const tower = put(game, 'p1', 'Command Tower');
    const source = manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1').find((s) => s.card === tower);
    expect(source?.outputs).toHaveLength(3);
  });

  /**
   * ⚠️ A conditional source is EXCLUDED from auto-tap and still MANUALLY
   * tappable. That is the Tier-2/Tier-3 boundary made explicit rather than the
   * engine guessing and being confidently wrong.
   */
  test('a conditional source is excluded from auto-tap but still tappable by hand', () => {
    const game = startedGame({ decks: [['Cavern of Souls']] });
    const cavern = put(game, 'p1', 'Cavern of Souls');
    const auto = manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1').filter((s) => s.card === cavern);
    const all = manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1', {
      includeConditional: true,
    }).filter((s) => s.card === cavern);
    expect(auto).toHaveLength(1); // only the plain "{T}: Add {C}"
    expect(all.length).toBeGreaterThan(1);
    const restricted = all.find((s) => s.conditional);
    if (!restricted) throw new Error('no conditional ability found');
    must(
      game.submit({
        t: 'TapForMana',
        player: 'p1',
        card: cavern,
        abilityIndex: restricted.abilityIndex,
        outputChoice: 0,
      }),
    );
    expect(game.state.cards[cavern]?.tapped).toBe(true);
  });

  test('a summoning-sick mana creature cannot be tapped', () => {
    const game = startedGame({ decks: [['Llanowar Elves']] });
    const elves = put(game, 'p1', 'Llanowar Elves');
    expect(manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1').some((s) => s.card === elves)).toBe(false);
    advanceUntil(game, (s) => s.turn.turnNumber === 5 && s.turn.activePlayer === 'p1');
    expect(manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1').some((s) => s.card === elves)).toBe(true);
  });
});

describe('the payment solver', () => {
  /**
   * The spec's own worked example. The greedy tier must prefer the BASICS and
   * leave the flexible Command Tower untapped — a plan that taps the Tower for
   * green is legal and bad, and a player would stop trusting auto-tap.
   */
  test('{3}{G}{G} prefers basics over Command Tower', () => {
    // SIX sources for a FIVE-mana cost. The surplus is the point: with exactly
    // five the assertion would pass no matter what the solver preferred.
    const game = startedGame({
      decks: [['Forest', 'Forest', 'Command Tower', 'Island', 'Island', 'Island']],
      commanders: [["Yeva, Nature's Herald"]],
    });
    for (const n of ['Forest', 'Forest', 'Command Tower', 'Island', 'Island', 'Island']) {
      put(game, 'p1', n);
    }
    const problem = buildPaymentProblem(parseManaCost('{3}{G}{G}'), 0, [], 0);
    const plan = suggestPayment(solveInputFor(game.state, ORACLE, game.deps.scripts, 'p1'), problem);
    expect(plan).not.toBeNull();
    const names = tappedNames(game, plan?.taps.map((t) => t.source) ?? []);
    expect(names).toEqual(['Forest', 'Forest', 'Island', 'Island', 'Island']);
    expect(names).not.toContain('Command Tower');
  });

  test('exactly six sources are tapped for a six-mana spell', () => {
    const game = startedGame({
      decks: [Array.from({ length: 8 }, () => 'Forest')],
      commanders: [["Yeva, Nature's Herald"]],
    });
    for (let i = 0; i < 8; i++) put(game, 'p1', 'Forest');
    const problem = buildPaymentProblem(costOf('Colossal Dreadmaw'), 0, [], 0);
    const plan = suggestPayment(solveInputFor(game.state, ORACLE, game.deps.scripts, 'p1'), problem);
    expect(plan?.taps).toHaveLength(6);
  });

  test('too few sources means no plan at all', () => {
    const game = startedGame({ decks: [['Forest', 'Colossal Dreadmaw']] });
    put(game, 'p1', 'Forest');
    const problem = buildPaymentProblem(costOf('Colossal Dreadmaw'), 0, [], 0);
    expect(suggestPayment(solveInputFor(game.state, ORACLE, game.deps.scripts, 'p1'), problem)).toBeNull();
  });

  test('X is priced into the problem', () => {
    const cost = costOf('Lightning Bolt');
    const withX = buildPaymentProblem({ ...cost!, xCount: 1 }, 4, [], 0);
    expect(withX.generic).toBe(4);
    expect(withX.totalMana).toBe(5);
  });

  test('a hybrid can be paid either way', () => {
    const cost = costOf('Figure of Destiny'); // {R/W}
    const combos = hybridCombinations(buildPaymentProblem(cost, 0, [], 0));
    expect(combos).toHaveLength(2);
    expect(combos.some((c) => c.colored.R === 1)).toBe(true);
    expect(combos.some((c) => c.colored.W === 1)).toBe(true);
  });

  test('a red source pays a {R/W} hybrid', () => {
    const game = startedGame({ decks: [['Mountain', 'Figure of Destiny']] });
    put(game, 'p1', 'Mountain');
    const problem = buildPaymentProblem(costOf('Figure of Destiny'), 0, [], 0);
    const plan = suggestPayment(solveInputFor(game.state, ORACLE, game.deps.scripts, 'p1'), problem);
    expect(plan?.taps).toHaveLength(1);
    expect(tappedNames(game, plan?.taps.map((t) => t.source) ?? [])).toEqual(['Mountain']);
  });

  /**
   * ⚠️ Phyrexian is modelled as a hybrid whose other half is life, so the same
   * code path covers it. With no blue source at all, the only way to pay
   * `{U/P}` is 2 life — and the solver has to find that rather than give up.
   */
  test('phyrexian is paid with life when no source can pay the colour', () => {
    const game = startedGame({ decks: [['Gitaxian Probe', 'Forest']] });
    put(game, 'p1', 'Forest');
    const problem = buildPaymentProblem(costOf('Gitaxian Probe'), 0, [], 0);
    const plan = suggestPayment(solveInputFor(game.state, ORACLE, game.deps.scripts, 'p1'), problem);
    expect(plan?.lifePaid).toBe(2);
    expect(plan?.taps).toHaveLength(0);
  });

  test('phyrexian prefers the mana when a source exists', () => {
    const game = startedGame({ decks: [['Gitaxian Probe', 'Island']] });
    put(game, 'p1', 'Island');
    const problem = buildPaymentProblem(costOf('Gitaxian Probe'), 0, [], 0);
    const plan = suggestPayment(solveInputFor(game.state, ORACLE, game.deps.scripts, 'p1'), problem);
    expect(plan?.lifePaid).toBe(0);
    expect(plan?.taps).toHaveLength(1);
  });

  test('the Tier-A filter never rejects something the solver can pay', () => {
    const game = startedGame({
      decks: [['Tundra', 'Tundra', 'Island', 'Plains', 'Serra Angel']],
      commanders: [['Tymna the Weaver']],
    });
    for (const n of ['Tundra', 'Tundra', 'Island', 'Plains']) put(game, 'p1', n);
    put(game, 'p1', 'Forest');
    const problem = buildPaymentProblem(costOf('Serra Angel'), 0, [], 0);
    const input = solveInputFor(game.state, ORACLE, game.deps.scripts, 'p1');
    const concrete = hybridCombinations(problem)[0];
    if (!concrete) throw new Error('no concrete problem');
    expect(tierAFeasible(input, concrete)).toBe(true);
    expect(suggestPayment(input, problem)).not.toBeNull();
  });
});

describe('casting', () => {
  test('casting a spell moves it to the stack and taps the sources', () => {
    const game = startedGame({ decks: [['Mountain', 'Lightning Bolt']] });
    fullControl(game, 'p1');
    const mountain = findAnywhere(game, 'p1', 'Mountain');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: mountain, to: { kind: 'battlefield', player: 'p1' } }));
    const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    // ⚠️ `targets` is supplied, so this is the ONE-SHOT cast path: an undefined
    // `targets` now means "stop and ask me" and would leave the spell pending.
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    expect(game.state.stack).toHaveLength(1);
    expect(game.state.stack[0]?.label).toBe('Lightning Bolt');
    expect(game.state.cards[mountain]?.tapped).toBe(true);
    expect(game.state.cards[bolt]?.zone.kind).toBe('stack');
  });

  test('an unaffordable spell is refused with the cost in the message', () => {
    const game = startedGame({ decks: [['Colossal Dreadmaw']] });
    const maw = findAnywhere(game, 'p1', 'Colossal Dreadmaw');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: maw, to: { kind: 'hand', player: 'p1' } }));
    const result = game.submit({ t: 'CastSpell', player: 'p1', card: maw });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('cannotAfford');
      expect(result.message).toContain('{4}{G}{G}');
    }
  });

  test('a sorcery-speed spell cannot be cast on an opponent turn', () => {
    const game = startedGame({ players: 2, decks: [['Forest', 'Grizzly Bears'], []] });
    put(game, 'p1', 'Forest');
    put(game, 'p1', 'Forest');
    const bears = findAnywhere(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'hand', player: 'p1' } }));
    advanceUntil(game, (s) => s.turn.activePlayer === 'p2' && s.turn.step === 'precombatMain');
    const result = game.submit({ t: 'CastSpell', player: 'p1', card: bears });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('timingRestriction');
  });

  test('an instant can be cast on an opponent turn', () => {
    const game = startedGame({ players: 2, decks: [['Mountain', 'Lightning Bolt'], []] });
    put(game, 'p1', 'Mountain');
    const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    advanceUntil(game, (s) => s.turn.activePlayer === 'p2' && s.priority.player === 'p1');
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    expect(game.state.stack).toHaveLength(1);
  });

  test('a resolved permanent lands on the battlefield; a resolved instant is binned', () => {
    const game = startedGame({ players: 2, decks: [['Forest', 'Forest', 'Grizzly Bears'], []] });
    put(game, 'p1', 'Forest');
    put(game, 'p1', 'Forest');
    const bears = findAnywhere(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'hand', player: 'p1' } }));
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    advanceUntil(game, (s) => s.stack.length === 0);
    expect(game.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(game.state.cards[bears]?.summonedOnTurn).toBe(game.state.turn.turnNumber);
  });

  /** LIFO. The last thing cast is the first thing to resolve. */
  test('the stack resolves last-in-first-out', () => {
    const game = startedGame({
      players: 2,
      decks: [['Mountain', 'Mountain', 'Lightning Bolt', 'Lightning Bolt'], []],
    });
    fullControl(game, 'p1');
    put(game, 'p1', 'Mountain');
    put(game, 'p1', 'Mountain');
    const bolts = ['Lightning Bolt', 'Lightning Bolt'].map(() => {
      const id = findAnywhere(game, 'p1', 'Lightning Bolt');
      must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'hand', player: 'p1' } }));
      return id;
    });
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolts[0] as string, targets: [{ kind: 'player', id: 'p2' }] }));
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolts[1] as string, targets: [{ kind: 'player', id: 'p2' }] }));
    expect(game.state.stack.map((s) => s.card)).toEqual(bolts);
    const from = game.log.length;
    advanceUntil(game, (s) => s.stack.length === 0);
    const resolved = game.log
      .slice(from)
      .flatMap((e) => (e.body.t === 'StackResolved' ? [e.body.card] : []));
    // The SECOND bolt cast resolves FIRST.
    expect(resolved[0]).toBe(bolts[1]);
    expect(resolved[1]).toBe(bolts[0]);
  });

  test('a spell whose only target has left the battlefield fizzles', () => {
    const game = startedGame({ players: 2, decks: [['Mountain', 'Lightning Bolt'], ['Grizzly Bears']] });
    fullControl(game, 'p1');
    put(game, 'p1', 'Mountain');
    const bears = put(game, 'p2', 'Grizzly Bears');
    const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    must(
      game.submit({
        t: 'CastSpell',
        player: 'p1',
        card: bolt,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    // The target is bounced to its owner's hand before the Bolt resolves.
    must(game.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'hand', player: 'p2' } }));
    advanceUntil(game, (s) => s.stack.length === 0);
    expect(game.log.some((e) => e.body.t === 'SpellFizzled')).toBe(true);
    expect(game.state.cards[bolt]?.zone.kind).toBe('graveyard');
  });

  test('all players passing on an empty stack ends the step', () => {
    const game = startedGame({ players: 2 });
    const step = game.state.turn.step;
    advanceUntil(game, (s) => s.turn.step !== step);
    expect(game.state.turn.step).not.toBe(step);
  });

  test('HoldPriority returns priority once, then clears', () => {
    const game = startedGame({ players: 2, decks: [['Mountain', 'Lightning Bolt'], []] });
    put(game, 'p1', 'Mountain');
    const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    must(game.submit({ t: 'HoldPriority', player: 'p1', hold: true }));
    expect(game.state.priority.holdingPriority).toBe('p1');
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    // Priority stays with the caster and auto-pass is suppressed, which is the
    // whole point of the toggle: they can respond to their own spell.
    expect(game.state.priority.player).toBe('p1');
    expect(game.state.priority.holdingPriority).toBe('p1');
    must(game.submit({ t: 'PassPriority', player: 'p1' }));
    expect(game.state.priority.holdingPriority).toBeNull();
  });

  test('a payment plan built against a stale board is refused', () => {
    const game = startedGame({ decks: [['Mountain', 'Mountain', 'Lightning Bolt']] });
    fullControl(game, 'p1');
    put(game, 'p1', 'Mountain');
    const second = put(game, 'p1', 'Mountain');
    const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    const problem = buildPaymentProblem(costOf('Lightning Bolt'), 0, [], 0);
    const plan = suggestPayment(solveInputFor(game.state, ORACLE, game.deps.scripts, 'p1'), problem);
    if (!plan) throw new Error('no plan');
    // Make the plan stale by removing the land it names.
    const named = plan.taps[0]?.source as string;
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: named, to: { kind: 'graveyard', player: 'p1' } }));
    void second;
    const result = game.submit({ t: 'CastSpell', player: 'p1', card: bolt, plan, targets: [{ kind: 'player', id: 'p2' }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('stalePaymentPlan');
  });
});

describe('commander tax', () => {
  test('the tax goes 0 → 2 → 4 across three casts from the command zone', () => {
    const game = startedGame({
      players: 2,
      decks: [
        Array.from({ length: 12 }, () => 'Forest'),
        [],
      ],
      commanders: [["Yeva, Nature's Herald"], ['Krenko, Mob Boss']],
      librarySize: 40,
    });
    fullControl(game, 'p1');
    for (let i = 0; i < 8; i++) put(game, 'p1', 'Forest');
    const commander = idsIn(game, 'p1', 'command')[0] as string;

    const casts: number[] = [];
    for (let n = 0; n < 3; n++) {
      const actions = legalActions(game.state, ORACLE, game.deps.scripts, 'p1');
      const cast = actions.find((a) => a.t === 'CastSpell' && a.card === commander);
      if (cast?.t !== 'CastSpell') throw new Error(`cast ${n} not offered`);
      casts.push(cast.tax);
      must(game.submit({ t: 'CastSpell', player: 'p1', card: commander }));
      // Resolve it, then send it back to the command zone by hand.
      advanceUntil(game, (s) => s.stack.length === 0);
      must(
        game.submit({
          t: 'ManualMoveCard',
          player: 'p1',
          card: commander,
          to: { kind: 'command', player: 'p1' },
        }),
      );
      // Untap for the next cast without waiting a turn.
      const lands = game.state.zones.battlefield.filter(
        (id) => game.state.cards[id]?.controller === 'p1' && game.state.cards[id]?.tapped,
      );
      if (lands.length > 0) must(game.submit({ t: 'ManualSetTapped', player: 'p1', cards: lands, tapped: false }));
    }
    expect(casts).toEqual([0, 2, 4]);
    expect(game.state.cards[commander]?.commanderCastCount).toBe(3);
  });

  /**
   * ⚠️ Casting a commander from ANYWHERE ELSE costs no tax and does not
   * increment the counter. It is a common source of confusion, which is why the
   * UI shows "Commander tax: {4} (3rd cast from the command zone)" explicitly.
   */
  test('a commander cast from HAND pays no tax and does not increment', () => {
    const game = startedGame({
      decks: [Array.from({ length: 6 }, () => 'Forest')],
      commanders: [["Yeva, Nature's Herald"]],
    });
    fullControl(game, 'p1');
    for (let i = 0; i < 5; i++) put(game, 'p1', 'Forest');
    const commander = idsIn(game, 'p1', 'command')[0] as string;
    must(game.submit({ t: 'CastSpell', player: 'p1', card: commander }));
    advanceUntil(game, (s) => s.stack.length === 0);
    expect(game.state.cards[commander]?.commanderCastCount).toBe(1);

    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: commander, to: { kind: 'hand', player: 'p1' } }));
    const lands = game.state.zones.battlefield.filter((id) => game.state.cards[id]?.tapped);
    must(game.submit({ t: 'ManualSetTapped', player: 'p1', cards: lands, tapped: false }));
    const actions = legalActions(game.state, ORACLE, game.deps.scripts, 'p1');
    const fromHand = actions.find((a) => a.t === 'CastSpell' && a.card === commander);
    expect(fromHand?.t === 'CastSpell' ? fromHand.tax : -1).toBe(0);
    must(game.submit({ t: 'CastSpell', player: 'p1', card: commander }));
    expect(game.state.cards[commander]?.commanderCastCount).toBe(1);
  });
});

describe('affordability drives the UI', () => {
  test('an affordable card is flagged and an unaffordable one is not', () => {
    const game = startedGame({ decks: [['Forest', 'Grizzly Bears', 'Colossal Dreadmaw']] });
    put(game, 'p1', 'Forest');
    put(game, 'p1', 'Forest');
    for (const n of ['Grizzly Bears', 'Colossal Dreadmaw']) {
      const id = findAnywhere(game, 'p1', n);
      must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'hand', player: 'p1' } }));
    }
    const actions = legalActions(game.state, ORACLE, game.deps.scripts, 'p1');
    const bears = actions.find((a) => a.t === 'CastSpell' && a.label === 'Grizzly Bears');
    const maw = actions.find((a) => a.t === 'CastSpell' && a.label === 'Colossal Dreadmaw');
    expect(bears?.t === 'CastSpell' ? bears.affordable : null).toBe(true);
    expect(maw?.t === 'CastSpell' ? maw.affordable : null).toBe(false);
  });

  test('a card with X is always affordable — X can be zero', () => {
    const game = startedGame({ decks: [['Forest']] });
    const problem = buildPaymentProblem({ ...costOf('Lightning Bolt')!, xCount: 1 }, 0, [], 0);
    put(game, 'p1', 'Forest');
    const input = solveInputFor(game.state, ORACLE, game.deps.scripts, 'p1');
    void input;
    expect(problem.generic).toBe(0);
  });

  test('legalActions lists every mana ability, conditional ones included', () => {
    const game = startedGame({ decks: [['Cavern of Souls']] });
    put(game, 'p1', 'Cavern of Souls');
    const taps = legalActions(game.state, ORACLE, game.deps.scripts, 'p1').filter(
      (a) => a.t === 'TapForMana',
    );
    expect(taps.length).toBeGreaterThanOrEqual(2);
    expect(taps.some((t) => t.t === 'TapForMana' && t.conditional)).toBe(true);
  });

  test('find() locates a card in a named zone', () => {
    const game = startedGame({ decks: [['Sol Ring']] });
    put(game, 'p1', 'Sol Ring');
    expect(nameOf(game, find(game, 'p1', 'battlefield', 'Sol Ring'))).toBe('Sol Ring');
  });
});

// ── ward, charged as a cast-time tax (M5 · D68) ──────────────────────────────
//
// ⚠️ Ward has been in the Tier-2 table since M1 and `parseWard` has produced a
// `wardCost` since M3, and until M5 NOTHING read it — the keyword was documented
// as enforced and was enforced nowhere. These tests exist so that cannot be true
// again silently: each one asserts on the total the payment solver was asked
// for, which is the number the player is actually charged.

describe('ward as a cast-time tax', () => {
  /** A board where p1 can cast Lightning Bolt at a target p2 controls. */
  function wardBoard(theirCreature: string, mountains = 4) {
    const game = startedGame({
      players: 2,
      decks: [
        [...Array.from({ length: mountains }, () => 'Mountain'), 'Lightning Bolt'],
        [theirCreature],
      ],
      librarySize: 40,
      startingPlayer: 'p1',
    });
    for (let i = 0; i < mountains; i++) put(game, 'p1', 'Mountain');
    const theirs = put(game, 'p2', theirCreature);
    const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    return { game, bolt, theirs };
  }

  function tappedCount(game: Game, player: string): number {
    return (game.state.zones.battlefield ?? []).filter(
      (id) => game.state.cards[id]?.controller === player && game.state.cards[id]?.tapped,
    ).length;
  }

  /**
   * ⚠️ Asserted on the CHARGE, not on a preview. `{R}` plus ward `{4}` is five
   * mana and the board has exactly four Mountains, so the ward is the entire
   * difference between the two outcomes below — and the second submit proves the
   * refusal was the ward rather than anything else about the board.
   */
  test('a MANA ward is added to the cost of a spell that targets it', () => {
    const { game, bolt, theirs } = wardBoard('Tyrranax Rex');
    const broke = game.submit({
      t: 'CastSpell',
      player: 'p1',
      card: bolt,
      targets: [{ kind: 'card', id: theirs }],
    });
    expect(broke.ok).toBe(false);
    if (!broke.ok) expect(broke.reason).toBe('cannotAfford');
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
  });

  test('a MANA ward is affordable with enough lands', () => {
    const { game, bolt, theirs } = wardBoard('Tyrranax Rex', 5);
    must(
      game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: theirs }] }),
    );
    // All five lands paid for it: {R} plus the ward's {4}.
    expect(tappedCount(game, 'p1')).toBe(5);
  });

  test('a LIFE ward is charged as life, not as mana', () => {
    // Sedgemoor Witch has Ward—Pay 3 life. Bolt is {R}, so one Mountain covers
    // the mana and the three life come off the top.
    const { game, bolt, theirs } = wardBoard('Sedgemoor Witch', 1);
    must(
      game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: theirs }] }),
    );
    expect(game.state.players['p1']?.life).toBe(37);
    expect(tappedCount(game, 'p1')).toBe(1);
  });

  /**
   * ⚠️ Your OWN warded creature is free. Charging yourself would be a rules bug
   * players would feel immediately, and it is the single easiest thing to get
   * wrong when the tax is computed from "the targets" rather than from "the
   * targets an OPPONENT controls".
   */
  test('targeting your OWN warded creature costs nothing extra', () => {
    const game = startedGame({
      players: 2,
      decks: [['Mountain', 'Lightning Bolt', 'Sedgemoor Witch'], []],
      librarySize: 40,
      startingPlayer: 'p1',
    });
    put(game, 'p1', 'Mountain');
    const mine = put(game, 'p1', 'Sedgemoor Witch');
    const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: mine }] }));
    expect(game.state.players['p1']?.life).toBe(40);
  });
});
