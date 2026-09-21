// D513 - THE FIRST-TIME-EACH-TURN HEAD. `Whenever <subject> <verb> for the first time each turn, <payload>` is the head
// without the suffix with D492's once-per-turn gate on the def: the first event of the turn triggers it and later ones
// do not. About the source itself the gate is exact (it cannot have attacked or been targeted before it existed); the
// two player heads with a turn record - `you gain life`, `you lose life` - carry an EXACT matcher beside the gate (the
// record BEFORE the event says whether the player already did it this turn, whether or not the source was there to see
// it). What is proven here, on the landed rows' own scripts: Aurelia attacking in the regular combat of turn 3 fires
// once and adds a combat (D512's seam); attacking again in that inserted combat fires nothing (two combats, not three);
// her next turn fires again (the gate is per turn). Vanguard Seraph asked once for two gains in one turn, and NOT asked
// for a gain after an earlier gain the Seraph did not see (it entered between them). Vengeful Warchief's one counter for
// two losses. The replay hash on each.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { AURELIA_THE_WARLEADER_SCRIPT } from './scripts/cards/aureliaTheWarleader';
import { VANGUARD_SERAPH_SCRIPT } from './scripts/cards/vanguardSeraph';
import { VENGEFUL_WARCHIEF_SCRIPT } from './scripts/cards/vengefulWarchief';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import type { Step } from './types/state';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const at = (g: Game, turn: number, step: Step) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.step === step && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const fired = (g: Game, source: InstanceId) => g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === source).length;
const combatsIn = (g: Game, turn: number): number => {
  let t = 0;
  let n = 0;
  for (const e of g.log) {
    if (e.body.t === 'TurnBegan') t = e.body.turnNumber;
    if (e.body.t === 'StepBegan' && e.body.step === 'beginCombat' && t === turn) n += 1;
  }
  return n;
};
const attack = (g: Game, card: InstanceId, turn: number) => {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p1', 40_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card, defender: { kind: 'player', id: 'p2' } }] }));
};

describe('D513 - the first-time-each-turn head', () => {
  test('the defs carry the once-per-turn gate; the life heads read the turn record before the event', () => {
    expect(AURELIA_THE_WARLEADER_SCRIPT.triggers?.every((t) => t.oncePerTurn === true)).toBe(true);
    expect(VANGUARD_SERAPH_SCRIPT.triggers?.every((t) => t.oncePerTurn === true && t.looksBack === true)).toBe(true);
    expect(VENGEFUL_WARCHIEF_SCRIPT.triggers?.every((t) => t.oncePerTurn === true && t.looksBack === true)).toBe(true);
  });

  test('Aurelia: the first attack of the turn fires and adds a combat; the attack in the inserted combat fires nothing; her next turn fires again; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Aurelia, the Warleader', 'Grizzly Bears'], ['Grizzly Bears']], scripts: createRegistry([AURELIA_THE_WARLEADER_SCRIPT]) });
    holdEverywhere(g);
    const aurelia = put(g, 'p1', 'Aurelia, the Warleader', 'battlefield');
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    settle(g);
    attack(g, bears, 3);
    // the Bears alone: not Aurelia attacking - nothing fires, one combat.
    at(g, 3, 'postcombatMain');
    expect(fired(g, aurelia), 'the Bears attacking is not Aurelia attacking').toBe(0);
    at(g, 5, 'precombatMain');
    attack(g, aurelia, 5);
    settle(g);
    expect(fired(g, aurelia), 'the first attack of the turn').toBe(1);
    expect(g.state.turn.extraPhases, 'the additional combat queued after this one').toEqual([{ after: 'combat', phases: ['combat'] }]);
    // the inserted combat: Aurelia (vigilance) attacks again - the second attack of the turn fires nothing.
    attack(g, aurelia, 5);
    settle(g);
    expect(fired(g, aurelia), 'the second attack of the turn is not the first').toBe(1);
    at(g, 5, 'end');
    expect(combatsIn(g, 5), 'two combats, not three').toBe(2);
    at(g, 7, 'precombatMain');
    attack(g, aurelia, 7);
    settle(g);
    expect(fired(g, aurelia), 'a new turn: the gate is per turn').toBe(2);
    at(g, 7, 'end');
    expect(combatsIn(g, 7)).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Vanguard Seraph: two gains in one turn ask once; a gain after one the Seraph did not see asks nothing; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Vanguard Seraph', 'Grizzly Bears'], ['Grizzly Bears']], scripts: createRegistry([VANGUARD_SERAPH_SCRIPT]) });
    holdEverywhere(g);
    const seraph = put(g, 'p1', 'Vanguard Seraph', 'battlefield');
    settle(g);
    at(g, 3, 'precombatMain');
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 3 }));
    settle(g);
    expect(fired(g, seraph), 'the first gain of the turn').toBe(1);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 2 }));
    settle(g);
    expect(fired(g, seraph), 'the second gain of the turn is not the first').toBe(1);
    // turn 5: the Seraph leaves, p1 gains, the Seraph returns, p1 gains again - the record says the player already gained
    // this turn, so the Seraph, which saw none of it, is not asked (the gate alone would have fired here).
    at(g, 5, 'precombatMain');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: seraph, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 3 }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: seraph, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 2 }));
    settle(g);
    expect(fired(g, seraph), 'a gain the record already holds: not the first of the turn').toBe(1);
    at(g, 7, 'precombatMain');
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 1 }));
    settle(g);
    expect(fired(g, seraph), 'the next turn').toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Vengeful Warchief: two losses in one turn, one counter; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Vengeful Warchief', 'Grizzly Bears'], ['Grizzly Bears']], scripts: createRegistry([VENGEFUL_WARCHIEF_SCRIPT]) });
    holdEverywhere(g);
    const chief = put(g, 'p1', 'Vengeful Warchief', 'battlefield');
    settle(g);
    at(g, 3, 'precombatMain');
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -3 }));
    settle(g);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -1 }));
    settle(g);
    expect(fired(g, chief)).toBe(1);
    expect(g.state.cards[chief]?.counters['+1/+1'] ?? 0, 'one counter for the first loss of the turn').toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
