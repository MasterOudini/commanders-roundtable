// D442 - THE CLEANUP DISCARD (CR 514.1) AND THE MAXIMUM HAND SIZE (CR 402.2): the active player discards down to
// their maximum hand size as the cleanup step's first turn-based action - a D137 discard prompt raised without
// `TurnBasedActionsDone`, the CR 514.2 actions (damage, until-end-of-turn) running only once the hand fits - and
// the six printed hand-size lines the step reads off the battlefield. A discard watcher waking during cleanup gets
// priority and another cleanup step (CR 514.3a's trigger arm).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { IVORA_INSATIABLE_HEIR_SCRIPT } from './scripts/cards/ivoraInsatiableHeir';
import { NO_SCRIPTS } from './scripts/registryCore';
import { advanceUntil, must, put, startedGame, ORACLE } from './testing/harness';
import { maxHandSize } from './turn';
import { parseHandSizeLine } from '../data/handSizeParse';
import { unaccountedLines } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import type { Game } from './game';

const FORESTS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
function game(p1: readonly string[], p2: readonly string[] = [], scripts = NO_SCRIPTS): Game {
  return startedGame({ players: 2, decks: [[...p1, ...FORESTS], [...p2, ...FORESTS]], scripts });
}
function draw(g: Game, player: 'p1' | 'p2', count: number): void {
  must(g.submit({ t: 'ManualDraw', player, target: player, count }));
}
function cleanupPrompt(g: Game) {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || s.turn.turnNumber > 1);
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'chooseFromZone') throw new Error(`expected the cleanup discard, got ${a?.kind ?? 'none'} at turn ${g.state.turn.turnNumber} ${g.state.turn.step}`);
  return a;
}

describe('the cleanup discard (D442)', () => {
  test('the six printed hand-size lines read; a duration or a chosen player does not', () => {
    expect(parseHandSizeLine('You have no maximum hand size.')).toEqual({ who: 'you', kind: 'none', n: 0, line: 'You have no maximum hand size.' });
    expect(parseHandSizeLine('Players have no maximum hand size.')).toEqual({ who: 'each', kind: 'none', n: 0, line: 'Players have no maximum hand size.' });
    expect(parseHandSizeLine('Your maximum hand size is two.')).toMatchObject({ who: 'you', kind: 'set', n: 2 });
    expect(parseHandSizeLine('Your maximum hand size is twenty.')).toMatchObject({ who: 'you', kind: 'set', n: 20 });
    expect(parseHandSizeLine('Your maximum hand size is reduced by three.')).toMatchObject({ who: 'you', kind: 'delta', n: -3 });
    expect(parseHandSizeLine('Your maximum hand size is increased by one.')).toMatchObject({ who: 'you', kind: 'delta', n: 1 });
    expect(parseHandSizeLine("Each opponent's maximum hand size is reduced by seven.")).toMatchObject({ who: 'opponents', kind: 'delta', n: -7 });
    expect(parseHandSizeLine('You have no maximum hand size for the rest of the game.')).toBeNull();
    expect(parseHandSizeLine('You have no maximum hand size until your next turn.')).toBeNull();
    expect(parseHandSizeLine("The chosen player's maximum hand size is four.")).toBeNull();
    expect(parseHandSizeLine("You have no maximum hand size and don't lose the game for having 0 or less life.")).toBeNull();
    for (const name of ['Reliquary Tower', 'Thought Nibbler', 'Gnat Miser', 'Minamo Scrollkeeper']) {
      const card = ENGINE_CARDS.find((c) => c.name === name);
      if (!card) throw new Error(`no fixture ${name}`);
      expect(unaccountedLines(card, 0), name).toEqual([]);
    }
    expect(ORACLE.byName('Reliquary Tower')?.faces[0]?.handSize).toMatchObject({ who: 'you', kind: 'none' });
  });

  test('nine cards at cleanup: the prompt asks for two, the CR 514.2 actions wait for the answer, the next turn begins', () => {
    const g = game(['Grizzly Bears']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    // The opening seven may hold the Bears, so the hand is filled to nine rather than drawn a fixed two.
    draw(g, 'p1', 9 - (g.state.zones.hand['p1']?.length ?? 0));
    expect(g.state.zones.hand['p1']).toHaveLength(9);
    const a = cleanupPrompt(g);
    expect(g.state.turn.step).toBe('cleanup');
    expect(g.state.turn.turnBasedActionsDone).toBe(false);
    expect(a).toMatchObject({ player: 'p1', zone: 'hand', rest: null, count: 2, label: 'Cleanup step' });
    const hand = g.state.zones.hand['p1'] ?? [];
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [hand[0] as string] }).ok).toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [hand[0] as string, hand[1] as string] }));
    expect(g.state.zones.hand['p1']).toHaveLength(7);
    expect(g.state.zones.graveyard['p1']).toEqual(expect.arrayContaining([hand[0], hand[1]]));
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.reason === 'discard' && m.card === hand[0]))).toBe(true);
    expect(g.state.turn.turnNumber).toBe(2);
    expect(g.state.turn.activePlayer).toBe('p2');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a hand of seven is not asked, and a Reliquary Tower lifts the limit entirely', () => {
    const g = game(['Reliquary Tower']);
    advanceUntil(g, (s) => s.turn.turnNumber > 1);
    expect(g.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone')).toBe(false);
    const g2 = game(['Reliquary Tower']);
    put(g2, 'p1', 'Reliquary Tower');
    draw(g2, 'p1', 5);
    expect(g2.state.zones.hand['p1']).toHaveLength(11);
    expect(maxHandSize(g2.state, ORACLE, NO_SCRIPTS, 'p1')).toBe(Infinity);
    expect(maxHandSize(g2.state, ORACLE, NO_SCRIPTS, 'p2')).toBe(7);
    advanceUntil(g2, (s) => s.turn.turnNumber > 1);
    expect(g2.state.zones.hand['p1']).toHaveLength(11);
    expect(g2.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone')).toBe(false);
  });

  test("a set replaces the seven, deltas add to it, an opponent's reduction reaches across the table, and none wins", () => {
    const g = game(['Null Profusion', 'Minamo Scrollkeeper', 'Thought Nibbler', 'Anvil of Bogardan'], ['Gnat Miser']);
    expect(maxHandSize(g.state, ORACLE, NO_SCRIPTS, 'p1')).toBe(7);
    put(g, 'p2', 'Gnat Miser');
    expect(maxHandSize(g.state, ORACLE, NO_SCRIPTS, 'p1'), "each opponent's is reduced by one").toBe(6);
    expect(maxHandSize(g.state, ORACLE, NO_SCRIPTS, 'p2'), 'not its controller').toBe(7);
    put(g, 'p1', 'Minamo Scrollkeeper');
    expect(maxHandSize(g.state, ORACLE, NO_SCRIPTS, 'p1'), 'increased by one').toBe(7);
    put(g, 'p1', 'Thought Nibbler');
    expect(maxHandSize(g.state, ORACLE, NO_SCRIPTS, 'p1'), 'reduced by two').toBe(5);
    put(g, 'p1', 'Null Profusion');
    expect(maxHandSize(g.state, ORACLE, NO_SCRIPTS, 'p1'), 'two, then the deltas: -1 +1 -2').toBe(0);
    put(g, 'p1', 'Anvil of Bogardan');
    expect(maxHandSize(g.state, ORACLE, NO_SCRIPTS, 'p1'), 'players have none').toBe(Infinity);
    expect(maxHandSize(g.state, ORACLE, NO_SCRIPTS, 'p2'), 'players have none').toBe(Infinity);
  });

  test('the discard wakes a watcher: the trigger resolves under priority and another cleanup follows (CR 514.3a)', () => {
    const scripts = createRegistry([IVORA_INSATIABLE_HEIR_SCRIPT]);
    const g = game(['Ivora, Insatiable Heir'], [], scripts);
    const ivora = put(g, 'p1', 'Ivora, Insatiable Heir');
    draw(g, 'p1', 8 - (g.state.zones.hand['p1']?.length ?? 0));
    const a = cleanupPrompt(g);
    expect(a.count).toBe(1);
    const hand = g.state.zones.hand['p1'] ?? [];
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [hand[0] as string] }));
    const from = g.log.findIndex((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone');
    const after = g.log.slice(from).map((e) => e.body);
    expect(after.some((b) => b.t === 'CleanupRepeatSet' && b.value === true)).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber > 1);
    const whole = g.log.slice(from).map((e) => e.body);
    expect(whole.filter((b) => b.t === 'StepBegan' && b.step === 'cleanup'), 'the repeated cleanup step').toHaveLength(1);
    expect(g.state.cards[ivora]?.counters['+1/+1']).toBe(1);
    expect(g.state.stack).toHaveLength(0);
    expect(g.state.turn.cleanupNeedsRepeat).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
