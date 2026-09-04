// D299 - the counted-targets seam: a spell's clause runs once per pick, the
// spell records the clause each declared target answers (`targetSlots`), and
// "up to N" / "N" / "any number of" target sentences are admitted. Proven three
// ways: the parse, the slots on the stack object, and real cards cast from the
// ORACLE with no script - each one a card the old positional consumer would
// have run WRONG (a creature declared alone for "destroy up to one target
// artifact. put a counter on up to one target creature" was clause 0's pick).

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { parseTargetClauses } from '../data/targetParse';
import { createRegistry } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

describe('counted target sentences parse with their count (D299)', () => {
  test('"up to two", "two", "any number of", "each of up to two" and the plural noun are admitted', () => {
    const upToTwo = parseEffects('Destroy up to two target creatures.', 'X', true);
    expect(upToTwo.mode).toBe('auto');
    expect(upToTwo.effects[0]?.kind).toBe('destroy');
    expect(upToTwo.effects[0]?.optional).toBe(true);
    const two = parseEffects('Tap two target creatures.', 'X', true);
    expect(two.mode).toBe('auto');
    expect(two.effects[0]?.optional).toBeUndefined();
    expect(parseEffects('Exile any number of target creatures.', 'X', true).effects[0]?.optional).toBe(true);
    expect(parseEffects('~ deals 2 damage to each of up to two target creatures.', 'X', true).mode).toBe('auto');
    expect(parseEffects('Return up to two target creature cards from your graveyard to your hand.', 'X', true).mode).toBe('auto');
    expect(parseEffects('Destroy up to one target artifact.', 'X', true).effects[0]?.optional).toBe(true);
    // A bare clause is what it always was.
    expect(parseEffects('Destroy target artifact.', 'X', true).effects[0]?.optional).toBeUndefined();
  });

  test('the target parser reads the same counts into the spec', () => {
    const upToTwo = parseTargetClauses('Destroy up to two target creatures.')[0];
    expect([upToTwo?.min, upToTwo?.max]).toEqual([0, 2]);
    const two = parseTargetClauses('Tap two target creatures.')[0];
    expect([two?.min, two?.max]).toEqual([2, 2]);
    expect(parseTargetClauses('Exile any number of target creatures.')[0]?.min).toBe(0);
  });

  test('"X target", "one or two target" and "up to two other target" stay refused', () => {
    expect(parseEffects('Destroy X target artifacts.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects('Tap one or two target creatures.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects('Tap up to two other target creatures.', 'X', true).mode).not.toBe('auto');
  });
});

const BEARS = 'Grizzly Bears';
const HAWK = 'Vampire Nighthawk'; // flying
const CALERIA = 'Lady Caleria';
const RING = 'Sol Ring';
const FOREST = 'Forest';
const SPELLS = ['Tidal Surge', 'Explosive Entry', 'Badlands Revival', 'Lethal Protection'];

type Mana = readonly (readonly ['W' | 'U' | 'B' | 'R' | 'G' | 'C', number])[];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(extras: readonly string[]): Game {
  const g = startedGame({ players: 2, decks: [[...SPELLS, ...extras], [BEARS]], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  return g;
}

function mainPhase(g: Game): void {
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
}

function cast(g: Game, spell: string, mana: Mana): InstanceId {
  const card = put(g, 'p1', spell, 'hand');
  for (const [sym, n] of mana) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return card;
}

function slotsOnTheStack(g: Game): readonly number[] | undefined {
  advanceUntil(g, (s) => s.stack.length === 1, 20_000);
  return g.state.stack[0]?.targetSlots;
}

describe('the cards run from the oracle alone (D299)', () => {
  test('Tidal Surge: one clause, two picks, both tapped; a flier is refused', () => {
    const g = game([BEARS, CALERIA, HAWK]);
    const bears = put(g, 'p1', BEARS, 'battlefield');
    const caleria = put(g, 'p1', CALERIA, 'battlefield');
    const hawk = put(g, 'p1', HAWK, 'battlefield');
    mainPhase(g);
    cast(g, 'Tidal Surge', [['U', 1], ['C', 1]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: caleria }] }));
    expect(slotsOnTheStack(g)).toEqual([0, 0]);
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[caleria]?.tapped).toBe(true);
    expect(g.state.cards[hawk]?.tapped).toBe(false);
  });

  test('Explosive Entry: no target declared for either clause resolves and touches nothing', () => {
    const g = game([BEARS, RING]);
    const bears = put(g, 'p1', BEARS, 'battlefield');
    const ring = put(g, 'p1', RING, 'battlefield');
    mainPhase(g);
    cast(g, 'Explosive Entry', [['R', 1], ['C', 1]]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    expect(slotsOnTheStack(g)).toEqual([]);
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(0);
  });

  test('Explosive Entry: a creature declared alone answers the SECOND clause - it gets the counter, nothing is destroyed', () => {
    const g = game([BEARS, RING]);
    const bears = put(g, 'p1', BEARS, 'battlefield');
    const ring = put(g, 'p1', RING, 'battlefield');
    mainPhase(g);
    cast(g, 'Explosive Entry', [['R', 1], ['C', 1]]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(slotsOnTheStack(g)).toEqual([1]);
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('Explosive Entry: declared creature-first, each pick still finds its clause', () => {
    const g = game([BEARS, RING]);
    const bears = put(g, 'p1', BEARS, 'battlefield');
    const ring = put(g, 'p1', RING, 'battlefield');
    mainPhase(g);
    cast(g, 'Explosive Entry', [['R', 1], ['C', 1]]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: ring }] }));
    expect(slotsOnTheStack(g)).toEqual([1, 0]);
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('Badlands Revival: a land card alone answers the hand clause, not the battlefield one', () => {
    const g = game([BEARS, FOREST]);
    const bears = put(g, 'p1', BEARS, 'graveyard');
    const forest = put(g, 'p1', FOREST, 'graveyard');
    mainPhase(g);
    cast(g, 'Badlands Revival', [['B', 1], ['G', 1], ['C', 3]]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: forest }] }));
    expect(slotsOnTheStack(g)).toEqual([1]);
    settle(g);
    expect(g.state.cards[forest]?.zone.kind).toBe('hand');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('Badlands Revival: both clauses, declared land-first', () => {
    const g = game([BEARS, FOREST]);
    const bears = put(g, 'p1', BEARS, 'graveyard');
    const forest = put(g, 'p1', FOREST, 'graveyard');
    mainPhase(g);
    cast(g, 'Badlands Revival', [['B', 1], ['G', 1], ['C', 3]]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: forest }, { kind: 'card', id: bears }] }));
    expect(slotsOnTheStack(g)).toEqual([1, 0]);
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[forest]?.zone.kind).toBe('hand');
  });

  test('Lethal Protection: the mandatory clause alone runs; the optional return, declared, runs too', () => {
    const g = game([CALERIA]);
    const bears = put(g, 'p2', BEARS, 'battlefield');
    const caleria = put(g, 'p1', CALERIA, 'graveyard');
    mainPhase(g);
    cast(g, 'Lethal Protection', [['B', 1], ['C', 3]]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(slotsOnTheStack(g)).toEqual([0]);
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[caleria]?.zone.kind).toBe('graveyard');

    const g2 = game([CALERIA]);
    const bears2 = put(g2, 'p2', BEARS, 'battlefield');
    const caleria2 = put(g2, 'p1', CALERIA, 'graveyard');
    mainPhase(g2);
    cast(g2, 'Lethal Protection', [['B', 1], ['C', 3]]);
    must(g2.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: caleria2 }, { kind: 'card', id: bears2 }] }));
    expect(slotsOnTheStack(g2)).toEqual([1, 0]);
    settle(g2);
    expect(g2.state.cards[bears2]?.zone.kind).toBe('graveyard');
    expect(g2.state.cards[caleria2]?.zone.kind).toBe('hand');
  });
});
