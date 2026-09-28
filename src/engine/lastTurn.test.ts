// D580 - THE LAST TURN'S SPELLS (CR 603.4). The turn keeps the spells each player cast during the PREVIOUS turn
// (`TurnState.lastTurnSpells` - the ending turn's `spellsCast`, kept by TurnBegan when any was cast): the older
// werewolves' intervening ifs read it (`if no spells were cast last turn`, `if a player cast two or more spells last
// turn`). What is proven here: p1's two spells in turn 3 are {p1: 2} through turn 4 while this turn's count starts
// empty, and the record is gone after turn 4 (nothing cast); a spell by each player in one turn is one each (no player
// cast two); nothing cast in turn 2 leaves no record at turn 3; the replay hash.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import type { Game } from './game';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const mainOf = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.awaiting === null && s.stack.length === 0 && s.priority.player === s.turn.activePlayer, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const red = (g: Game, player: 'p1' | 'p2') => must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: 'R', amount: 1 }));

describe("D580 - the last turn's spells", () => {
  test('two spells by p1 are kept through the next turn and gone after an empty one', () => {
    const g = startedGame({ players: 2, decks: [['Lightning Bolt', 'Lightning Bolt', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const b1 = put(g, 'p1', 'Lightning Bolt', 'hand');
    const b2 = put(g, 'p1', 'Lightning Bolt', 'hand');
    mainOf(g, 3);
    expect(g.state.turn.lastTurnSpells, 'nothing was cast in turn 2').toBeUndefined();
    for (const b of [b1, b2]) {
      red(g, 'p1');
      must(g.submit({ t: 'CastSpell', player: 'p1', card: b, targets: [{ kind: 'player', id: 'p2' }] }));
      settle(g);
    }
    expect(g.state.turn.spellsCast.p1, 'two this turn').toBe(2);
    mainOf(g, 4);
    expect(g.state.turn.lastTurnSpells, 'turn 3: p1 cast two').toEqual({ p1: 2 });
    expect(g.state.turn.spellsCast, 'this turn starts empty').toEqual({});
    mainOf(g, 5);
    expect(g.state.turn.lastTurnSpells, 'turn 4: nothing was cast').toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a spell by each player in one turn is one each - no player cast two', () => {
    const g = startedGame({ players: 2, decks: [['Lightning Bolt', ...LANDS], ['Lightning Bolt', ...LANDS]] });
    holdEverywhere(g);
    const mine = put(g, 'p1', 'Lightning Bolt', 'hand');
    const theirs = put(g, 'p2', 'Lightning Bolt', 'hand');
    mainOf(g, 3);
    red(g, 'p1');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mine, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    // p2 answers in p1's own turn, at instant speed.
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.player === 'p2' && s.stack.length === 0 && s.priority.awaiting === null, 20_000);
    red(g, 'p2');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: theirs, targets: [{ kind: 'player', id: 'p1' }] }));
    settle(g);
    mainOf(g, 4);
    expect(g.state.turn.lastTurnSpells).toEqual({ p1: 1, p2: 1 });
    expect(Object.values(g.state.turn.lastTurnSpells ?? {}).some((n) => n >= 2), 'no player cast two').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
