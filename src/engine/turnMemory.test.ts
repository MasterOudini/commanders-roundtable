// D336 - THE TURN MEMORY. `TurnState.spellsCast` and `TurnState.cardsDrawn`
// count per player and start over as each turn begins; "whenever you cast your
// second spell each turn" (Thunder Drake) and "whenever you draw your second
// card each turn" (Faerie Vandal) read them. The first and the third do
// nothing, an ability on the stack is not a spell, a draw step is one card and
// a Divination two, and a new turn starts the count over for everyone.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { THUNDER_DRAKE_SCRIPT } from './scripts/cards/thunderDrake';
import { FAERIE_VANDAL_SCRIPT } from './scripts/cards/faerieVandal';
import { DRUDGE_SKELETONS_SCRIPT } from './scripts/cards/drudgeSkeletons';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
const plusOnes = (g: Game, id: InstanceId): number => g.state.cards[id]?.counters['+1/+1'] ?? 0;
function mana(g: Game, player: 'p1' | 'p2', symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void {
  must(g.submit({ t: 'ManualAddMana', player, target: player, symbol, amount }));
}
function atMain(g: Game, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
}

/** Thunder Drake and Drudge Skeletons on p1's board at its third-turn main phase; three spells to cast. */
function drakes(): { g: Game; drake: InstanceId; skeletons: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Thunder Drake', 'Drudge Skeletons', 'Pyretic Ritual', 'Grizzly Bears', 'Giant Growth'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([THUNDER_DRAKE_SCRIPT, DRUDGE_SKELETONS_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const drake = put(g, 'p1', 'Thunder Drake');
  settle(g);
  const skeletons = put(g, 'p1', 'Drudge Skeletons');
  settle(g);
  atMain(g, 3);
  return { g, drake, skeletons };
}
function castRitual(g: Game): void {
  const ritual = put(g, 'p1', 'Pyretic Ritual', 'hand');
  mana(g, 'p1', 'R', 1);
  mana(g, 'p1', 'C', 1);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
  settle(g);
}
function castBears(g: Game): void {
  const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
  mana(g, 'p1', 'G', 2);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
  settle(g);
}
function castGrowth(g: Game, onto: InstanceId): void {
  const growth = put(g, 'p1', 'Giant Growth', 'hand');
  mana(g, 'p1', 'G', 1);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: growth, targets: [{ kind: 'card', id: onto }] }));
  settle(g);
}

/** Faerie Vandal on p1's board at its third-turn main phase; two Divinations to cast. */
function vandals(): { g: Game; vandal: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Faerie Vandal', 'Divination', 'Divination'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([FAERIE_VANDAL_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const vandal = put(g, 'p1', 'Faerie Vandal');
  settle(g);
  atMain(g, 3);
  return { g, vandal };
}
/** Cast a Divination already in hand (put() finds one in the opening hand as readily as in the library, so the hand is measured after it). */
function castDivination(g: Game, div: InstanceId): void {
  mana(g, 'p1', 'U', 1);
  mana(g, 'p1', 'C', 2);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: div }));
  settle(g);
}

describe('D336 - the turn memory', () => {
  test('the second spell of the turn fires the trigger; the first and the third do not, and the tally counts each', () => {
    const { g, drake } = drakes();
    expect(g.state.turn.spellsCast.p1 ?? 0).toBe(0);
    castRitual(g);
    expect(g.state.turn.spellsCast.p1).toBe(1);
    expect(plusOnes(g, drake)).toBe(0);
    castBears(g);
    expect(g.state.turn.spellsCast.p1).toBe(2);
    expect(plusOnes(g, drake)).toBe(1);
    castGrowth(g, drake);
    expect(g.state.turn.spellsCast.p1).toBe(3);
    expect(plusOnes(g, drake)).toBe(1);
  });

  test('an ability on the stack is not a spell: it neither counts nor makes the next spell the second', () => {
    const { g, drake, skeletons } = drakes();
    mana(g, 'p1', 'B', 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: skeletons, abilityIndex: 0 }));
    settle(g);
    expect(g.state.regenerationShields[skeletons]).toBe(1);
    expect(g.state.turn.spellsCast.p1 ?? 0).toBe(0);
    castBears(g);
    expect(g.state.turn.spellsCast.p1).toBe(1);
    expect(plusOnes(g, drake)).toBe(0);
  });

  test('the spell count starts over as a turn begins', () => {
    const { g, drake } = drakes();
    castRitual(g);
    expect(g.state.turn.spellsCast.p1).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(g.state.turn.spellsCast).toEqual({});
    atMain(g, 5);
    castBears(g);
    expect(g.state.turn.spellsCast).toEqual({ p1: 1 });
    expect(plusOnes(g, drake)).toBe(0);
  });

  test('the draw step is the first card; a Divination draws the second and the third, and the trigger fires once', () => {
    const { g, vandal } = vandals();
    expect(g.state.turn.cardsDrawn).toEqual({ p1: 1 });
    const first = put(g, 'p1', 'Divination', 'hand');
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    castDivination(g, first);
    expect(g.state.turn.cardsDrawn).toEqual({ p1: 3 });
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 - 1 + 2);
    expect(plusOnes(g, vandal)).toBe(1);
    const second = put(g, 'p1', 'Divination', 'hand');
    castDivination(g, second);
    expect(g.state.turn.cardsDrawn).toEqual({ p1: 5 });
    expect(plusOnes(g, vandal)).toBe(1);
  });

  test('the draw tally is per player and starts over as a turn begins', () => {
    const { g } = vandals();
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain', 40_000);
    expect(g.state.turn.cardsDrawn).toEqual({ p2: 1 });
    atMain(g, 5);
    expect(g.state.turn.cardsDrawn).toEqual({ p1: 1 });
  });

  test('replays to the same hash', () => {
    const { g, drake } = drakes();
    castRitual(g);
    castBears(g);
    castGrowth(g, drake);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
