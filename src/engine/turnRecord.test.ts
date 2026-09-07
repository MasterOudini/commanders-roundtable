// D348 - THE TURN RECORD. A turn remembers what it has already seen, so an
// activation can ask: "if a creature died this turn", "if an opponent lost life
// this turn", "if you've cast a noncreature spell this turn". The record is kept
// by `reducer.ts`, which has no oracle and therefore stores IDS; the types are
// asked by `activationConditions.ts`, which does. These prove both halves - the
// record filling from real play, and the conditions reading it - and that
// `TurnBegan` clears it, which is what makes it a TURN record and not a game one.
import { describe, expect, test } from 'vitest';
import { activationConditionsHold } from './activationConditions';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { ActivationCondition } from './types/oracle';

const BEARS = 'Grizzly Bears';
const CYCLOPS = 'Cyclops of One-Eyed Pass';
const RITUAL = 'Pyretic Ritual';
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p1's third-turn main phase, with priority and nothing pending. */
function myMain(g: Game): void {
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
    20_000,
  );
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[BEARS, RITUAL, RING, BEARS], [CYCLOPS]],
    scripts: createRegistry([]),
  });
  holdEverywhere(g);
  return g;
}

/** Ask one condition of p1, with a source it does not read. */
function holds(g: Game, cond: ActivationCondition, source: string): boolean {
  const d = deps(createRegistry([]));
  return activationConditionsHold(g.state, d.oracle, d.scripts, 'p1', source, [cond]);
}

describe('D348 - the turn record fills from play', () => {
  test('a creature that dies is remembered, with the controller it had', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    myMain(g);
    expect(g.state.turn.memory.died).toEqual([]);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.died).toEqual([{ card: bears, controller: 'p1' }]);
  });

  test('what enters, what leaves a graveyard, and what is discarded', () => {
    const g = game();
    myMain(g);
    const ring = put(g, 'p1', RING);
    const inYard = put(g, 'p1', BEARS, 'graveyard');
    settle(g);
    expect(g.state.turn.memory.entered.p1).toContain(ring);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: inYard, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.leftGraveyard.p1).toBe(1);
    const inHand = put(g, 'p1', RITUAL, 'hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: inHand, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.discarded.p1).toBe(1);
  });

  test('life lost and life gained are remembered per player', () => {
    const g = game();
    myMain(g);
    expect(g.state.turn.memory.lostLife.p2 ?? false).toBe(false);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -1 }));
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 2 }));
    settle(g);
    expect(g.state.turn.memory.lostLife.p2).toBe(true);
    expect(g.state.turn.memory.gainedLife.p1).toBe(true);
    expect(g.state.turn.memory.gainedLife.p2 ?? false).toBe(false);
  });

  test('a spell cast is remembered as its card, and a token as a token', () => {
    const g = game();
    myMain(g);
    const ritual = put(g, 'p1', RITUAL, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
    settle(g);
    expect(g.state.turn.memory.cast.p1).toContain(ritual);
    expect(g.state.turn.memory.tokensCreated.p1 ?? 0).toBe(0);
  });

  test('⚠️ the record is a TURN record: the next turn starts empty', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    myMain(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.died).toHaveLength(1);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(g.state.turn.memory.died).toEqual([]);
    expect(g.state.turn.memory.lostLife).toEqual({});
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('D348 - the conditions read it, and derive what the record could not', () => {
  test('"if a creature died this turn" is false until one does, and a land dying does not count', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS);
    const land = put(g, 'p1', 'Forest');
    settle(g);
    myMain(g);
    const cond: ActivationCondition = {
      kind: 'turnMemory',
      what: 'died',
      who: 'any',
      count: 1,
      any: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }],
      none: null,
    };
    expect(holds(g, cond, bears)).toBe(false);
    // ⚠️ A LAND dying is remembered too - the record stores ids - and the CHECK is what
    // says it was not a creature. That is the whole reason the types are asked here.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.died).toHaveLength(1);
    expect(holds(g, cond, bears)).toBe(false);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(holds(g, cond, bears)).toBe(true);
  });

  test('"if an opponent lost life this turn" reads the opponent, not you', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    myMain(g);
    const cond: ActivationCondition = { kind: 'turnMemory', what: 'lostLife', who: 'opponent', count: 1, any: null, none: null };
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -3 }));
    settle(g);
    expect(holds(g, cond, bears)).toBe(false);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -3 }));
    settle(g);
    expect(holds(g, cond, bears)).toBe(true);
  });

  test('"a noncreature spell" and "an instant or sorcery spell" read the cast cards', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    myMain(g);
    const noncreature: ActivationCondition = {
      kind: 'turnMemory',
      what: 'cast',
      who: 'you',
      count: 1,
      any: null,
      none: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }],
    };
    const instantSorcery: ActivationCondition = {
      kind: 'turnMemory',
      what: 'cast',
      who: 'you',
      count: 1,
      any: [
        { supertypes: [], types: ['Instant'], subtypes: [], colors: [] },
        { supertypes: [], types: ['Sorcery'], subtypes: [], colors: [] },
      ],
      none: null,
    };
    expect(holds(g, noncreature, bears)).toBe(false);
    const spell = put(g, 'p1', RITUAL, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    expect(holds(g, noncreature, bears)).toBe(true);
    expect(holds(g, instantSorcery, bears)).toBe(true);
  });

  test('"an artifact entered under your control this turn" reads the entering card, not the caster', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    myMain(g);
    const cond: ActivationCondition = {
      kind: 'turnMemory',
      what: 'entered',
      who: 'you',
      count: 1,
      any: [{ supertypes: [], types: ['Artifact'], subtypes: [], colors: [] }],
      none: null,
    };
    put(g, 'p1', BEARS);
    settle(g);
    expect(holds(g, cond, bears)).toBe(false);
    put(g, 'p1', RING);
    settle(g);
    expect(holds(g, cond, bears)).toBe(true);
  });
});
