// D343 - THE MODAL SEAM, the spell half. A whole-text modal instant or sorcery
// ("Choose <word> —" and its "• mode" lines) is read mode by mode
// (`modalParse.ts`), the cast chooses its modes FIRST (CR 601.2b) through the
// `chooseModes` prompt, only the chosen modes' clauses are aimed and re-checked,
// and only the chosen modes' effects resolve (`engine/modes.ts`). Proven on
// three real cards from the ORACLE with no script: Crushing Canopy (choose
// one), Dawn to Dusk (choose one or both) and Blue Elemental Blast (a mode on
// the stack, a mode on the battlefield) - the mode offered only while its
// targets can be filled, the cast not offered at all when too few modes can be
// chosen, the answer refused by name, the log replaying.
import { describe, expect, test } from 'vitest';
import { engineCompleteness } from '../data/engineComplete';
import { parseModalFace } from '../data/modalParse';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { modalEffects, modeChoiceOf, modeChoiceProblem, modeSpecs } from './modes';
import { createRegistry } from './scripts/registryCore';
import { ORACLE, advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const CANOPY = 'Crushing Canopy';
const DAWN = 'Dawn to Dusk';
const BLAST = 'Blue Elemental Blast';
const BEARS = 'Grizzly Bears';
const ELEMENTAL = 'Air Elemental'; // a blue flyer
const WARMTH = 'Warmth'; // an enchantment
const DRAGON = 'Shivan Dragon'; // a red flyer
const BOLT = 'Lightning Bolt'; // a red spell

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function fuel(g: Game, player: 'p1' | 'p2'): void {
  for (const symbol of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player, target: player, symbol, amount: 4 }));
  }
}
function game(p1: readonly string[], p2: readonly string[]): Game {
  const g = startedGame({ players: 2, decks: [[...p1], [...p2]], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  return g;
}
function myMain(g: Game): void {
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
}
const cardTarget = (id: InstanceId) => ({ kind: 'card', id }) as const;

describe('D343 - the modal read', () => {
  test('a whole-text modal face reads mode by mode, and only the whole text', () => {
    const dawn = parseModalFace('Choose one or both —\n• Return target enchantment card from your graveyard to your hand.\n• Destroy target enchantment.', DAWN, true);
    expect(dawn).not.toBeNull();
    expect([dawn?.min, dawn?.max]).toEqual([1, 2]);
    expect(dawn?.modes.map((m) => m.targets.length)).toEqual([1, 1]);
    expect(dawn?.modes.map((m) => m.effectMode)).toEqual(['auto', 'auto']);
    // A permanent is never modal here; a modal group beside another sentence is not the whole text.
    expect(parseModalFace('Choose one —\n• Draw a card.\n• You gain 2 life.', 'X', false)).toBeNull();
    expect(parseModalFace('Convoke\nChoose one —\n• Draw a card.\n• You gain 2 life.', 'X', true)).toBeNull();
    // The count words.
    expect(modeChoiceOf('one', 3)).toEqual({ min: 1, max: 1 });
    expect(modeChoiceOf('two', 4)).toEqual({ min: 2, max: 2 });
    expect(modeChoiceOf('one or both', 2)).toEqual({ min: 1, max: 2 });
    expect(modeChoiceOf('one or both', 3)).toBeNull();
    expect(modeChoiceOf('one or more', 3)).toEqual({ min: 1, max: 3 });
    expect(modeChoiceOf('any number', 2)).toEqual({ min: 0, max: 2 });
    expect(modeChoiceOf('four', 4)).toBeNull();
  });

  test('the chosen modes\' effects shift their target indices over the chosen modes\' clauses', () => {
    const dawn = parseModalFace('Choose one or both —\n• Return target enchantment card from your graveyard to your hand.\n• Destroy target enchantment.', DAWN, true);
    if (!dawn) throw new Error('no modal face');
    expect(modeSpecs(dawn.modes, [1]).map((s) => s.text)).toEqual(['target enchantment']);
    expect(modeSpecs(dawn.modes, [1, 0]).length).toBe(2);
    expect(modalEffects(dawn, [1]).map((e) => e.targetIndex)).toEqual([0]);
    expect(modalEffects(dawn, [0, 1]).map((e) => e.targetIndex)).toEqual([0, 1]);
    // The answer's rules: distinct, in range, within [min, max], among the offered.
    expect(modeChoiceProblem(2, 1, 1, [0, 1], [0])).toBeNull();
    expect(modeChoiceProblem(2, 1, 1, [0, 1], [0, 0])).toContain('at most once');
    expect(modeChoiceProblem(2, 1, 1, [0, 1], [2])).toContain('not one of the modes');
    expect(modeChoiceProblem(2, 1, 1, [0, 1], [])).toContain('at least 1');
    expect(modeChoiceProblem(2, 1, 1, [0, 1], [0, 1])).toContain('at most 1');
    expect(modeChoiceProblem(2, 1, 2, [1], [0])).toContain('no legal target');
  });

  test('the three proof spells are complete by the accounting with no script', () => {
    for (const name of [CANOPY, DAWN, BLAST]) {
      const card = ORACLE.byName(name);
      if (!card) throw new Error(`no fixture ${name}`);
      const face = card.faces[0];
      expect(face?.modal, name).not.toBeNull();
      expect(face?.effectMode, name).toBe('auto');
      expect(face?.targets, name).toEqual([]);
      expect(engineCompleteness(card.data).complete, name).toBe(true);
    }
  });
});

describe('D343 - Crushing Canopy: choose one', () => {
  /** p1 at its own main with the Canopy in hand and mana; p2 holds a flyer and an enchantment. */
  function board(opts: { flyer?: boolean; enchantment?: boolean } = { flyer: true, enchantment: true }): { g: Game; canopy: InstanceId; flyer: InstanceId | null; warmth: InstanceId | null } {
    const g = game([CANOPY, BEARS], [ELEMENTAL, WARMTH, BEARS]);
    const flyer = opts.flyer ? put(g, 'p2', ELEMENTAL) : null;
    const warmth = opts.enchantment ? put(g, 'p2', WARMTH) : null;
    put(g, 'p2', BEARS);
    myMain(g);
    const canopy = put(g, 'p1', CANOPY, 'hand');
    fuel(g, 'p1');
    return { g, canopy, flyer, warmth };
  }

  test('the cast asks for a mode first; the enchantment mode aims at the enchantment alone and destroys it', () => {
    const { g, canopy, flyer, warmth } = board();
    must(g.submit({ t: 'CastSpell', player: 'p1', card: canopy }));
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseModes');
    if (ask?.kind !== 'chooseModes') return;
    expect(ask.player).toBe('p1');
    expect(ask.forKind).toBe('spell');
    expect(ask.options).toEqual(['Destroy target creature with flying.', 'Destroy target enchantment.']);
    expect(ask.legal).toEqual([0, 1]);
    expect([ask.min, ask.max]).toEqual([1, 1]);
    expect(g.state.pendingCast?.stage).toBe('modes');
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    const aim = g.state.priority.awaiting;
    expect(aim?.kind).toBe('chooseTargets');
    if (aim?.kind !== 'chooseTargets') return;
    expect(aim.specs.map((s) => s.text)).toEqual(['target enchantment']);
    expect(g.state.pendingCast?.modes).toEqual([1]);
    // The flyer is not a legal target of the chosen mode.
    const wrong = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [cardTarget(flyer as InstanceId)] });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe('illegalTarget');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [cardTarget(warmth as InstanceId)] }));
    advanceUntil(g, (s) => s.stack.length === 1, 20_000);
    expect(g.state.stack[0]?.modes).toEqual([1]);
    settle(g);
    expect(g.state.cards[warmth as InstanceId]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flyer as InstanceId]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[canopy]?.zone.kind).toBe('graveyard');
  });

  test('the flyer mode, named inline with its target, completes with no prompt and kills the flyer', () => {
    const { g, canopy, flyer, warmth } = board();
    must(g.submit({ t: 'CastSpell', player: 'p1', card: canopy, modes: [0], targets: [cardTarget(flyer as InstanceId)] }));
    expect(g.state.priority.awaiting).toBeNull();
    settle(g);
    expect(g.state.cards[flyer as InstanceId]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[warmth as InstanceId]?.zone.kind).toBe('battlefield');
  });

  test('a mode whose target cannot be filled is not offered, and choosing it anyway is refused by name', () => {
    const { g, canopy } = board({ flyer: false, enchantment: true });
    must(g.submit({ t: 'CastSpell', player: 'p1', card: canopy }));
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseModes');
    if (ask?.kind === 'chooseModes') expect(ask.legal).toEqual([1]);
    const refused = g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe('illegalMode');
      expect(refused.message).toContain('no legal target');
    }
    // Two modes for a "choose one" is refused too; the right one is accepted.
    expect(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0, 1] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  });

  test('with no mode choosable the cast is not offered at all, and a hand-built cast is refused', () => {
    const { g, canopy } = board({ flyer: false, enchantment: false });
    const d = deps();
    const offered = legalActions(g.state, d.oracle, d.scripts, 'p1').some((a) => a.t === 'CastSpell' && a.card === canopy);
    expect(offered).toBe(false);
    const refused = g.submit({ t: 'CastSpell', player: 'p1', card: canopy });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe('illegalMode');
    expect(g.state.pendingCast).toBeNull();
    expect(g.state.cards[canopy]?.zone.kind).toBe('hand');
  });

  test('the modes and the answer replay to the same hash', () => {
    const { g, canopy, warmth } = board();
    must(g.submit({ t: 'CastSpell', player: 'p1', card: canopy }));
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [cardTarget(warmth as InstanceId)] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('D343 - Dawn to Dusk: choose one or both', () => {
  function board(): { g: Game; dawn: InstanceId; mine: InstanceId; theirs: InstanceId } {
    const g = game([DAWN, WARMTH, BEARS], [WARMTH, BEARS]);
    const theirs = put(g, 'p2', WARMTH);
    put(g, 'p2', BEARS);
    const mine = put(g, 'p1', WARMTH, 'graveyard');
    myMain(g);
    const dawn = put(g, 'p1', DAWN, 'hand');
    fuel(g, 'p1');
    return { g, dawn, mine, theirs };
  }

  test('both modes: two clauses asked in printed order, the return and the destruction both resolve', () => {
    const { g, dawn, mine, theirs } = board();
    must(g.submit({ t: 'CastSpell', player: 'p1', card: dawn }));
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseModes');
    if (ask?.kind === 'chooseModes') {
      expect([ask.min, ask.max]).toEqual([1, 2]);
      expect(ask.legal).toEqual([0, 1]);
    }
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1, 0] }));
    expect(g.state.pendingCast?.modes).toEqual([0, 1]);
    const aim = g.state.priority.awaiting;
    expect(aim?.kind).toBe('chooseTargets');
    if (aim?.kind === 'chooseTargets') expect(aim.specs.length).toBe(2);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [cardTarget(mine), cardTarget(theirs)] }));
    settle(g);
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('one mode alone: the destruction only, and the graveyard card stays where it was', () => {
    const { g, dawn, mine, theirs } = board();
    must(g.submit({ t: 'CastSpell', player: 'p1', card: dawn, modes: [1], targets: [cardTarget(theirs)] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
  });

  test('a mode with a target that has gone is skipped at resolution; the other still resolves (CR 608.2b)', () => {
    const { g, dawn, mine, theirs } = board();
    must(g.submit({ t: 'CastSpell', player: 'p1', card: dawn, modes: [0, 1], targets: [cardTarget(mine), cardTarget(theirs)] }));
    // p2's enchantment leaves in response: the destroy clause has no target left, the return still happens.
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'exile', player: 'p2' } }));
    settle(g);
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[theirs]?.zone.kind).toBe('exile');
  });
});

describe('D343 - Blue Elemental Blast: a mode on the stack, a mode on the battlefield', () => {
  test('the permanent mode is offered alone while no red spell is on the stack, and destroys the Dragon', () => {
    const g = game([BLAST, BEARS], [DRAGON, BOLT, BEARS]);
    const dragon = put(g, 'p2', DRAGON);
    put(g, 'p2', BEARS);
    myMain(g);
    const blast = put(g, 'p1', BLAST, 'hand');
    fuel(g, 'p1');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: blast }));
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseModes');
    if (ask?.kind === 'chooseModes') expect(ask.legal).toEqual([1]);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [cardTarget(dragon)] }));
    settle(g);
    expect(g.state.cards[dragon]?.zone.kind).toBe('graveyard');
  });

  test('the spell mode counters a held red spell; the Bolt never lands', () => {
    const g = game([BLAST, BEARS], [BOLT, BEARS]);
    put(g, 'p2', BEARS);
    settle(g);
    // p2's own main phase: a Bolt at p1, held on the stack for p1 to answer.
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null, 60_000);
    const bolt = put(g, 'p2', BOLT, 'hand');
    fuel(g, 'p2');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'player', id: 'p1' }] }));
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 1, 20_000);
    const life = g.state.players.p1?.life ?? 0;
    const blast = put(g, 'p1', BLAST, 'hand');
    fuel(g, 'p1');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: blast }));
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseModes');
    if (ask?.kind === 'chooseModes') expect(ask.legal).toEqual([0]);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] }));
    const top = g.state.stack[g.state.stack.length - 1];
    if (!top) throw new Error('nothing on the stack');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: top.id }] }));
    settle(g);
    expect(g.state.cards[bolt]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(life);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
