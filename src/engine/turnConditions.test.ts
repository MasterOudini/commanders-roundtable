// D398 - THE TURN RECORD, WIDENED, AND THE CONDITIONS ON EVERY ABILITY KIND. D348
// gave a turn a memory for "Activate only if ..."; the same memory answers a
// trigger's intervening if ("When this enters, if you attacked this turn, ..."),
// an entering replacement's trailing if ("enters with a +1/+1 counter on it if a
// creature died this turn"), Bloodthirst, and a static's "as long as". What the
// record lacked is added here and proven from real play: what LEFT the battlefield
// (to any zone, with the controller it had), DAMAGE dealt to a player (life lost
// without damage is not damage - the difference Bloodthirst is written on), HOW
// MUCH life was gained or lost beside whether, a card put into a graveyard from
// ANYWHERE (descend), the turn's draw count, and the source itself - required by
// "this land entered this turn", excluded by "another spell this turn". The parser
// reads the widened wordings, an outside wording stays unread, and every game
// replays to its hash.
import { describe, expect, test } from 'vitest';
import { parseActivationConditions } from '../data/activatedParse';
import type { PermanentPredicate } from '../data/replacementParse';
import { activationConditionsHold } from './activationConditions';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { PlayerId } from './types/ids';
import type { ActivationCondition, TurnMemoryQuestion } from './types/oracle';

const BEARS = 'Grizzly Bears';
const CYCLOPS = 'Cyclops of One-Eyed Pass';
const RITUAL = 'Pyretic Ritual';
const FOREST = 'Forest';
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
    decks: [[BEARS, RITUAL, RING, BEARS, FOREST, RITUAL], [CYCLOPS]],
    scripts: createRegistry([]),
  });
  holdEverywhere(g);
  return g;
}
/** Ask one condition of a player, with a source it may or may not read. */
function holdsFor(g: Game, player: PlayerId, cond: ActivationCondition, source: string): boolean {
  const d = deps(createRegistry([]));
  return activationConditionsHold(g.state, d.oracle, d.scripts, player, source, [cond]);
}
function tm(
  what: TurnMemoryQuestion,
  who: 'you' | 'opponent' | 'any',
  count: number,
  extra: { any?: readonly PermanentPredicate[] | null; none?: readonly PermanentPredicate[] | null; self?: true; excludeSelf?: true } = {},
): ActivationCondition {
  return { kind: 'turnMemory', what, who, count, any: null, none: null, ...extra };
}
const P_CREATURE: readonly PermanentPredicate[] = [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }];
const P_LAND: readonly PermanentPredicate[] = [{ supertypes: [], types: ['Land'], subtypes: [], colors: [] }];
const P_PERMANENT: readonly PermanentPredicate[] = ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle'].map((t) => ({
  supertypes: [],
  types: [t],
  subtypes: [],
  colors: [],
}));
function castRitual(g: Game, card: string): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  settle(g);
}

describe('D398 - the turn record, widened', () => {
  test('what leaves the battlefield is remembered with its controller, whatever the destination; died is the graveyard subset', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS);
    const forest = put(g, 'p1', FOREST);
    settle(g);
    myMain(g);
    expect(g.state.turn.memory.left).toEqual([]);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.left).toEqual([{ card: bears, controller: 'p1' }]);
    expect(g.state.turn.memory.died).toEqual([]);
    expect(holdsFor(g, 'p1', tm('left', 'you', 1), forest)).toBe(true);
    // "a nonland permanent left the battlefield": the Bears is one.
    expect(holdsFor(g, 'p1', tm('left', 'any', 1, { none: P_LAND }), forest)).toBe(true);
    // p2 controlled nothing that left.
    expect(holdsFor(g, 'p2', tm('left', 'you', 1), forest)).toBe(false);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: forest, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.left).toHaveLength(2);
    expect(g.state.turn.memory.died).toEqual([{ card: forest, controller: 'p1' }]);
    // Two left, but only one of them was a nonland permanent.
    expect(holdsFor(g, 'p1', tm('left', 'you', 2, { none: P_LAND }), forest)).toBe(false);
  });

  test('damage dealt to a player is remembered; life lost without damage is not damage; attacked is the active player alone', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    myMain(g);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -3 }));
    settle(g);
    expect(g.state.turn.memory.lifeLost.p2).toBe(3);
    expect(g.state.turn.memory.lostLife.p2).toBe(true);
    expect(g.state.turn.memory.damaged.p2 ?? 0).toBe(0);
    expect(holdsFor(g, 'p1', tm('damaged', 'opponent', 1), bears)).toBe(false);
    expect(holdsFor(g, 'p1', tm('lostLife', 'opponent', 1), bears)).toBe(true);
    expect(holdsFor(g, 'p1', tm('attackers', 'you', 1), bears)).toBe(false);
    // The Bears attacks and connects: two combat damage to p2.
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
      20_000,
    );
    expect(g.state.turn.memory.damaged.p2).toBe(2);
    expect(g.state.turn.memory.lifeLost.p2).toBe(5);
    expect(holdsFor(g, 'p1', tm('damaged', 'opponent', 1), bears)).toBe(true);
    expect(holdsFor(g, 'p1', tm('damaged', 'you', 1), bears)).toBe(false);
    // "you attacked this turn" is the active player's alone; "any" is everyone's.
    expect(holdsFor(g, 'p1', tm('attackers', 'you', 1), bears)).toBe(true);
    expect(holdsFor(g, 'p1', tm('attackers', 'you', 2), bears)).toBe(false);
    expect(holdsFor(g, 'p2', tm('attackers', 'you', 1), bears)).toBe(false);
    expect(holdsFor(g, 'p2', tm('attackers', 'any', 1), bears)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('how much life was gained or lost, beside whether', () => {
    const g = game();
    myMain(g);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 2 }));
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 3 }));
    settle(g);
    expect(g.state.turn.memory.lifeGained.p1).toBe(5);
    expect(g.state.turn.memory.gainedLife.p1).toBe(true);
    expect(holdsFor(g, 'p1', tm('lifeGained', 'you', 5), 'x')).toBe(true);
    expect(holdsFor(g, 'p1', tm('lifeGained', 'you', 6), 'x')).toBe(false);
    expect(holdsFor(g, 'p2', tm('lifeGained', 'you', 1), 'x')).toBe(false);
    expect(holdsFor(g, 'p2', tm('lifeGained', 'opponent', 5), 'x')).toBe(true);
  });

  test('a card put into a graveyard from anywhere is remembered (descend), and the check derives which are permanent cards', () => {
    const g = game();
    myMain(g);
    const ritual = put(g, 'p1', RITUAL, 'hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: ritual, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.toGraveyard.p1).toEqual([ritual]);
    // An instant is no permanent card: no descend yet.
    expect(holdsFor(g, 'p1', tm('toGraveyard', 'you', 1, { any: P_PERMANENT }), 'x')).toBe(false);
    const forest = put(g, 'p1', FOREST, 'hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: forest, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.toGraveyard.p1).toEqual([ritual, forest]);
    expect(holdsFor(g, 'p1', tm('toGraveyard', 'you', 1, { any: P_PERMANENT }), 'x')).toBe(true);
    // Both were discards too - the record keeps each fact on its own slot.
    expect(g.state.turn.memory.discarded.p1).toBe(2);
  });

  test('the source itself: required by "this land entered this turn", excluded by "another spell this turn"', () => {
    const g = game();
    myMain(g);
    const bears = put(g, 'p1', BEARS);
    put(g, 'p1', RING);
    settle(g);
    expect(holdsFor(g, 'p1', tm('entered', 'you', 1, { self: true }), bears)).toBe(true);
    expect(holdsFor(g, 'p1', tm('entered', 'you', 1, { self: true }), 'nothing')).toBe(false);
    expect(holdsFor(g, 'p1', tm('entered', 'you', 2, { self: true }), bears)).toBe(false);
    const first = put(g, 'p1', RITUAL, 'hand');
    castRitual(g, first);
    expect(holdsFor(g, 'p1', tm('cast', 'you', 1), first)).toBe(true);
    // "another spell": the only spell cast is this one, so none other.
    expect(holdsFor(g, 'p1', tm('cast', 'you', 1, { excludeSelf: true }), first)).toBe(false);
    const second = put(g, 'p1', RITUAL, 'hand');
    castRitual(g, second);
    expect(holdsFor(g, 'p1', tm('cast', 'you', 1, { excludeSelf: true }), second)).toBe(true);
    expect(holdsFor(g, 'p1', tm('cast', 'you', 2), second)).toBe(true);
    expect(holdsFor(g, 'p1', tm('cast', 'you', 2, { excludeSelf: true }), second)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('"drawn" reads the turn draw count', () => {
    const g = game();
    myMain(g);
    // The third turn's draw step drew one card - a real draw, which a manual
    // library-to-hand move is not (it is a zone move, and the count does not see it).
    expect(g.state.turn.cardsDrawn.p1).toBe(1);
    expect(holdsFor(g, 'p1', tm('drawn', 'you', 1), 'x')).toBe(true);
    expect(holdsFor(g, 'p1', tm('drawn', 'you', 2), 'x')).toBe(false);
    expect(holdsFor(g, 'p2', tm('drawn', 'you', 1), 'x')).toBe(false);
    must(g.submit({ t: 'ManualDraw', player: 'p1', target: 'p1', count: 2 }));
    settle(g);
    expect(holdsFor(g, 'p1', tm('drawn', 'you', 2), 'x')).toBe(false);
  });

  test('a new turn clears every widened fact', () => {
    const g = game();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    myMain(g);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 2 }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    expect(g.state.turn.memory.left).toHaveLength(1);
    expect(g.state.turn.memory.lifeGained.p1).toBe(2);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 20_000);
    expect(g.state.turn.memory.left).toEqual([]);
    expect(g.state.turn.memory.lifeGained).toEqual({});
    expect(g.state.turn.memory.damaged).toEqual({});
    expect(g.state.turn.memory.toGraveyard).toEqual({});
  });
});

describe('D398 - the parser reads the widened wordings', () => {
  const read = (c: string): readonly ActivationCondition[] => parseActivationConditions('{T}: Draw a card. Activate only ' + c + '.').conditions;
  test('attacks, exits, damage, amounts, the source, descend, draws', () => {
    expect(read('if you attacked this turn')).toEqual([tm('attackers', 'you', 1)]);
    expect(read('if you attacked with three or more creatures this turn')).toEqual([tm('attackers', 'you', 3)]);
    expect(read('if a permanent left the battlefield under your control this turn')).toEqual([tm('left', 'you', 1)]);
    expect(read('if a permanent you controlled left the battlefield this turn')).toEqual([tm('left', 'you', 1)]);
    expect(read('if a nonland permanent left the battlefield this turn')).toEqual([tm('left', 'any', 1, { none: P_LAND })]);
    expect(read('if an opponent was dealt damage this turn')).toEqual([tm('damaged', 'opponent', 1)]);
    expect(read('if you gained 3 or more life this turn')).toEqual([tm('lifeGained', 'you', 3)]);
    expect(read("if you've cast another spell this turn")).toEqual([tm('cast', 'you', 1, { excludeSelf: true })]);
    expect(read("if you've cast three or more spells this turn")).toEqual([tm('cast', 'you', 3)]);
    expect(read('if another creature died this turn')).toEqual([tm('died', 'any', 1, { any: P_CREATURE, excludeSelf: true })]);
    expect(read('if two or more creatures died this turn')).toEqual([tm('died', 'any', 2, { any: P_CREATURE })]);
    expect(read('if this land entered this turn')).toEqual([tm('entered', 'you', 1, { self: true })]);
    expect(read('if a land entered the battlefield under your control this turn')).toEqual([tm('entered', 'you', 1, { any: P_LAND })]);
    expect(read('if two or more nonland permanents entered the battlefield under your control this turn')).toEqual([tm('entered', 'you', 2, { none: P_LAND })]);
    expect(read('if you descended this turn')).toEqual([tm('toGraveyard', 'you', 1, { any: P_PERMANENT })]);
    expect(read("if you've drawn two or more cards this turn")).toEqual([tm('drawn', 'you', 2)]);
  });
  test('the D348 wordings still read, and a wording outside the set stays unread', () => {
    expect(read('if a creature died this turn')).toEqual([tm('died', 'any', 1, { any: P_CREATURE })]);
    expect(read('if an opponent lost life this turn')).toEqual([tm('lostLife', 'opponent', 1)]);
    const outside = parseActivationConditions('{T}: Draw a card. Activate only if you attacked yesterday.');
    expect(outside.conditions).toEqual([]);
    expect(outside.unread).toBe('if you attacked yesterday');
  });
});
