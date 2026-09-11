// D402 - THE DELAYED TRIGGER (CR 603.7): a sentence that happens "at the beginning of the next turn's
// upkeep" / "the next end step" / "your next upkeep" is read as its immediate effect armed for that
// step. The resolution ARMS it (`DelayedTriggerArmed` on `state.delayedTriggers`), the trigger bus
// puts it on the stack when the first such step BEGINS after the arming, and the ability runs the
// carried effects over no targets. Only a sentence with no target, no referent, no ask and no
// payment is read delayed: the referent forms (`Sacrifice it at the beginning of the next end
// step.`) stay unread, on purpose.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import { apply } from './reducer';
import { collectTriggers } from './triggers';
import { RULES_CAUSE, type GameEvent } from './types/events';
import type { GameState, Step } from './types/state';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

describe('the delayed trigger (D402)', () => {
  test('the delay is read off the sentence, in both positions, and a referent or a target stays unread', () => {
    const wine = parseEffects("You gain 1 life.\nDraw a card at the beginning of the next turn's upkeep.", 'Blessed Wine', true);
    expect(wine.mode).toBe('auto');
    expect(wine.effects.map((e) => [e.kind, e.delay])).toEqual([
      ['gainLife', null],
      ['draw', { step: 'upkeep', whose: 'next' }],
    ]);
    const led = parseEffects('At the beginning of the next end step, draw a card.', 'Test Card', true);
    expect(led.mode).toBe('auto');
    expect(led.effects.map((e) => [e.kind, e.delay])).toEqual([['draw', { step: 'end', whose: 'next' }]]);
    const own = parseEffects('You gain 2 life at the beginning of your next upkeep.', 'Test Card', true);
    expect(own.mode).toBe('auto');
    expect(own.effects.map((e) => [e.kind, e.amount, e.delay])).toEqual([['gainLife', 2, { step: 'upkeep', whose: 'controller' }]]);
    const token = parseEffects('Create a 1/1 white Spirit creature token with flying at the beginning of the next end step.', 'Transluminant', true);
    expect(token.mode).toBe('auto');
    expect(token.effects.map((e) => [e.kind, e.delay])).toEqual([['createToken', { step: 'end', whose: 'next' }]]);
    // A referent names an object the fire does not carry across the wait: the whole spell stays assisted.
    const wave = parseEffects('Create a 5/5 blue Wall creature token with defender. Sacrifice it at the beginning of the next end step.', 'Tidal Wave', true);
    expect(wave.mode).not.toBe('auto');
    // A target cannot be re-checked at a step that begins turns later.
    const targeted = parseEffects("Destroy target creature at the beginning of the next turn's upkeep.", 'Test Card', true);
    expect(targeted.mode).not.toBe('auto');
  });

  test("a cantrip's draw waits for the next turn's upkeep, then happens once, and the game replays", () => {
    const g = startedGame({ players: 2, decks: [['Blessed Wine', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const wine = put(g, 'p1', 'Blessed Wine', 'hand');
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: wine }));
    settle(g);
    expect(g.state.players.p1?.life, 'the life came now').toBe(life0 + 1);
    expect((g.state.zones.hand.p1 ?? []).length, 'the draw did not').toBe(hand0 - 1);
    expect(g.state.delayedTriggers.map((d) => [d.when, d.effects.map((e) => e.kind)])).toEqual([[{ step: 'upkeep', whose: 'next' }, ['draw']]]);
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 3 && s.turn.step === 'upkeep', 20_000);
    settle(g);
    expect(g.state.turn.activePlayer, "the next turn's upkeep is the opponent's").toBe('p2');
    expect((g.state.zones.hand.p1 ?? []).length, 'the card came at the upkeep').toBe(hand0);
    expect(g.state.delayedTriggers, 'the entry left the list as it fired').toEqual([]);
    expect(g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.delayedEffects !== undefined).length, 'it fired once, as an ability').toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 5 && s.turn.step === 'upkeep', 40_000);
    settle(g);
    expect((g.state.zones.hand.p1 ?? []).length, 'and never again').toBe(hand0 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the next end step is the first one to BEGIN after the arming (the bus, over the reducer): this turn from the main phase, a later turn from the end step', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears'], ['Grizzly Bears']] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const base = g.state;
    const draw = parseEffects('At the beginning of the next end step, draw a card.', 'Test Card', true).effects[0];
    if (!draw || !draw.delay) throw new Error('the probe sentence must parse delayed');
    const armedIn = (step: Step): GameState =>
      apply(base, { seq: 1, stepId: 1, cause: RULES_CAUSE, body: { t: 'DelayedTriggerArmed', trigger: { id: 'probe', controller: 'p1', source: bears, when: draw.delay!, armedTurn: base.turn.turnNumber, armedStep: step, effects: [{ ...draw, delay: null }], label: 'probe' } } });
    const at = (state: GameState, turnNumber: number, step: Step): GameState => ({ ...state, turn: { ...state.turn, turnNumber, step } });
    const began = (step: Step): GameEvent => ({ seq: 2, stepId: 2, cause: RULES_CAUSE, body: { t: 'StepBegan', phase: 'ending', step } });
    const fires = (before: GameState, after: GameState, step: Step) => collectTriggers(before, after, [began(step)], deps().oracle, deps().scripts).filter((t) => t.delayed === 'probe');
    const t0 = base.turn.turnNumber;
    // Armed in the main phase: this turn's end step is the first to begin after it.
    const main = armedIn('precombatMain');
    expect(fires(main, at(main, t0, 'end'), 'end'), 'fires at this turn').toHaveLength(1);
    expect(fires(main, at(main, t0, 'upkeep'), 'upkeep'), 'not at an upkeep').toHaveLength(0);
    // Armed DURING the end step: that step has begun, so the first to begin after it is a later turn's.
    const late = armedIn('end');
    expect(fires(late, at(late, t0, 'end'), 'end'), 'not the step it was armed in').toHaveLength(0);
    expect(fires(late, at(late, t0 + 1, 'end'), 'end'), "the next turn's end step").toHaveLength(1);
    // The upkeep kinds always wait for a later turn; `your next upkeep` for the controller's own.
    const own = apply(base, { seq: 1, stepId: 1, cause: RULES_CAUSE, body: { t: 'DelayedTriggerArmed', trigger: { id: 'probe', controller: 'p1', source: bears, when: { step: 'upkeep', whose: 'controller' }, armedTurn: t0, armedStep: 'precombatMain', effects: [{ ...draw, delay: null }], label: 'probe' } } });
    const p2turn = { ...at(own, t0 + 1, 'upkeep'), turn: { ...own.turn, turnNumber: t0 + 1, step: 'upkeep' as const, activePlayer: 'p2' as const } };
    expect(fires(own, p2turn, 'upkeep'), "not the opponent's upkeep").toHaveLength(0);
    expect(fires(own, at(own, t0 + 2, 'upkeep'), 'upkeep'), 'the controller\'s next').toHaveLength(1);
  });
});
