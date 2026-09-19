// D502 - THE EXTRA TURN (CR 500.7). `Take an extra turn after this one.` / `Target player takes an extra turn after this
// one.` / `... two extra turns ...` put an entry on `GameState.extraTurns`, a stack: the most recently created extra turn
// is taken first (500.7), the regular succession resumes after the player whose regular turn was interrupted
// (`TurnState.regular`), and an entry whose player has left the game is dropped untaken. `Skip the untap step of that
// turn.` right after the clause (Savor the Moment) marks the entry just added. What is proven here: the readings; Temporal
// Manipulation's extra turn between p1's turn 3 and p2's turn 5; Time Warp aimed at the opponent (p2 takes turn 4 as an
// extra turn and turn 5 as its own); Time Stretch's two; the LIFO order of two spells cast in one main phase; Savor the
// Moment's skipped untap step (a tapped Bears stays tapped through it, no permanent's own skip is spent); a departed
// player's extra turn dropped; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.awaiting === null && s.stack.length === 0, 60_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, self: e.self === true, amount: e.amount })) }; };
/** The active player of each turn from 4 on, with a mark on the extra ones, walked to `last`. */
function turnsUpTo(g: Game, last: number): string[] {
  const seen: string[] = [];
  for (let t = 4; t <= last; t++) {
    main(g, t);
    seen.push(`${t}:${g.state.turn.activePlayer}${g.state.turn.extra !== undefined ? '*' : ''}`);
  }
  return seen;
}

describe('D502 - the extra turn', () => {
  test('the readings: the self forms, the aimed form, two turns, and the skipped untap step only right after its turn', () => {
    expect(kinds('Take an extra turn after this one.')).toEqual({ mode: 'auto', effects: [{ kind: 'extraTurn', self: true, amount: 1 }] });
    expect(kinds('You take an extra turn after this one.')).toEqual({ mode: 'auto', effects: [{ kind: 'extraTurn', self: true, amount: 1 }] });
    expect(kinds('Target player takes an extra turn after this one.')).toEqual({ mode: 'auto', effects: [{ kind: 'extraTurn', self: false, amount: 1 }] });
    expect(kinds('Target player takes two extra turns after this one.')).toEqual({ mode: 'auto', effects: [{ kind: 'extraTurn', self: false, amount: 2 }] });
    expect(kinds('Take an extra turn after this one. Skip the untap step of that turn.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'extraTurn' }, { kind: 'skipUntapThatTurn', self: true }] });
    expect(kinds('Target player takes an extra turn after this one. Return up to one target nonland permanent to its owner\'s hand. Exile ~.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'extraTurn' }, { kind: 'bounce' }, { kind: 'exileSelf' }] });
    expect(kinds('Draw a card. Skip the untap step of that turn.').mode, 'no extra turn before it: unread').not.toBe('auto');
  });

  test('Temporal Manipulation: p1 takes turn 4 as an extra turn, then the succession resumes with p2; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Temporal Manipulation', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Temporal Manipulation', 'hand');
    main(g, 3);
    mana(g, 'p1', 'UUUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(g.state.extraTurns, 'one extra turn waiting, p1\'s').toEqual([{ player: 'p1' }]);
    expect(g.log.some((e) => e.body.t === 'Narrated' && e.body.text.includes('will take an extra turn after this one')), 'said out loud').toBe(true);
    expect(turnsUpTo(g, 6)).toEqual(['4:p1*', '5:p2', '6:p1']);
    expect(g.state.extraTurns, 'taken').toEqual([]);
    expect(g.log.filter((e) => e.body.t === 'TurnBegan' && e.body.extra !== undefined)).toHaveLength(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Time Warp aimed at the opponent: p2 takes turn 4 as an extra turn and turn 5 as its own regular turn, then p1', () => {
    const g = startedGame({ players: 2, decks: [['Time Warp', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Time Warp', 'hand');
    main(g, 3);
    mana(g, 'p1', 'UUUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.extraTurns).toEqual([{ player: 'p2' }]);
    expect(turnsUpTo(g, 6)).toEqual(['4:p2*', '5:p2', '6:p1']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Time Stretch: two extra turns for the target, then the regular one', () => {
    const g = startedGame({ players: 2, decks: [['Time Stretch', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Time Stretch', 'hand');
    main(g, 3);
    mana(g, 'p1', 'UUUUUUUUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.extraTurns).toEqual([{ player: 'p2' }, { player: 'p2' }]);
    expect(turnsUpTo(g, 7)).toEqual(['4:p2*', '5:p2*', '6:p2', '7:p1']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('two spells in one main phase: the extra turn created last is taken first (CR 500.7), the other after it, then the succession', () => {
    const g = startedGame({ players: 2, decks: [['Time Warp', 'Temporal Manipulation', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const warp = put(g, 'p1', 'Time Warp', 'hand');
    const manip = put(g, 'p1', 'Temporal Manipulation', 'hand');
    main(g, 3);
    mana(g, 'p1', 'UUUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: warp, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    mana(g, 'p1', 'UUUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: manip, targets: [] }));
    settle(g);
    expect(g.state.extraTurns).toEqual([{ player: 'p2' }, { player: 'p1' }]);
    expect(turnsUpTo(g, 7)).toEqual(['4:p1*', '5:p2*', '6:p2', '7:p1']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Savor the Moment: the extra turn skips its untap step - a tapped Bears stays tapped through it and untaps on p1's next own turn", () => {
    const g = startedGame({ players: 2, decks: [['Savor the Moment', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const spell = put(g, 'p1', 'Savor the Moment', 'hand');
    main(g, 3);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    mana(g, 'p1', 'UUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(g.state.extraTurns).toEqual([{ player: 'p1', skipUntap: true }]);
    main(g, 4);
    expect(g.state.turn.extra, 'the extra turn, marked').toEqual({ player: 'p1', skipUntap: true });
    expect(g.state.cards[bears]?.tapped, 'still tapped: the untap step was skipped').toBe(true);
    expect(g.log.some((e) => e.body.t === 'Narrated' && e.body.text.includes('its untap step is skipped')), 'said out loud').toBe(true);
    expect(g.log.some((e) => e.body.t === 'PermanentsUntapped' && e.body.cards.includes(bears)), 'no untap of the Bears yet').toBe(false);
    main(g, 5);
    expect(g.state.turn.activePlayer).toBe('p2');
    main(g, 6);
    expect(g.state.turn.activePlayer).toBe('p1');
    expect(g.state.cards[bears]?.tapped, "untapped on p1's next regular turn").toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an extra turn of a player who has left the game is dropped untaken (three seats: the game goes on)', () => {
    const g = startedGame({ players: 3, decks: [['Time Warp', 'Grizzly Bears'], ['Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Time Warp', 'hand');
    // Turn 4 is p1's second turn at a three-seat table.
    main(g, 4);
    expect(g.state.turn.activePlayer).toBe('p1');
    mana(g, 'p1', 'UUUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p3' }] }));
    settle(g);
    expect(g.state.extraTurns).toEqual([{ player: 'p3' }]);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p3', delta: -40 }));
    settle(g);
    expect(g.state.players.p3?.hasLost, 'p3 has left').toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 5, 60_000);
    expect(g.log.some((e) => e.body.t === 'ExtraTurnDropped' && e.body.player === 'p3'), "the departed player's extra turn is dropped").toBe(true);
    expect(g.state.extraTurns).toEqual([]);
    expect(g.state.turn.activePlayer, 'the succession resumes with p2').toBe('p2');
    expect(g.state.turn.extra).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
