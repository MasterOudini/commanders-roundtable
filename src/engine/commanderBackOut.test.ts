// Copy to src/engine/ (imports are relative to that folder).
//
// D587 - BACKING OUT OF A CAST IS A REVERSAL, NOT A ZONE CHANGE (FIX-LIST item 3; the review's commander F5). A cast that
// is backed out of (`CancelPendingCast`) is undone under the rules' Handling Illegal Actions: the card goes back where it
// came from, as it was, and nothing applies to the undo. On master aedb4001 the undo went through the replacement funnel
// like any move: a commander cast from its owner's hand and backed out of was held and ASKED "put it into the command zone
// instead?" (CR 903.9b), or sent there silently under the "always" option; a foretold commander backed out of was marked
// owed a 903.9a choice and asked again at the next state-based check. The undo move now carries `reversal`, which the
// commander rule skips and the reducer's owed mark leaves as it stood. A madness cast backed out of is NOT a reversal - its
// graveyard is the madness instruction's own (CR 702.35a); commanderCastableExile.test.ts proves that side.
//
// Endless One stands in for a commander with {X} in its cost (the X stage stops the cast, so it can be backed out of);
// Demon Bolt for a foretold one with a target to choose. Each test failed on aedb4001; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame, type TestGameOpts } from './testing/harness';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';
import type { GameOptions } from './types/state';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Island', 'Island', 'Island'];

function table(opts: { mode?: GameOptions['commanderZoneReplacement']; decks: NonNullable<TestGameOpts['decks']>; commanders: NonNullable<TestGameOpts['commanders']> }): Game {
  const g = startedGame({ players: 2, decks: opts.decks, commanders: opts.commanders, options: { commanderZoneReplacement: opts.mode ?? 'ask', maxHandSize: null } });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}
const main = (g: Game, turn: number) =>
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const commanderOf = (g: Game, p: PlayerId) => (g.state.zones.command[p] ?? [])[0] as InstanceId;
const toHand = (g: Game, card: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
const mana = (g: Game, symbol: 'R' | 'C', amount: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
const asked = (g: Game) => g.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'commanderZoneChoice').length;
const replays = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

describe('F5 - a backed-out cast of a commander goes back as it was: no 903.9 question, no trip home', () => {
  for (const mode of ['ask', 'always'] as const) {
    test(`a commander cast from its owner's hand and backed out of at its X stage returns to the hand (the "${mode}" option)`, () => {
      const g = table({ mode, decks: [LANDS, LANDS], commanders: [['Endless One'], ['Krenko, Mob Boss']] });
      const one = commanderOf(g, 'p1');
      toHand(g, one);
      expect(asked(g), 'a move out of the command zone is not asked about').toBe(0);
      must(g.submit({ t: 'CastSpell', player: 'p1', card: one }));
      expect(g.state.pendingCast?.stage, 'the cast stops to ask for X').toBe('x');
      expect(g.state.cards[one]?.zone.kind).toBe('stack');
      must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
      expect(g.state.priority.awaiting, mode === 'ask' ? 'the undo is not held and asked about' : 'nothing is asked').toBeNull();
      expect(g.state.pendingReplacement).toBeNull();
      expect(g.state.pendingCast, 'the cast is gone').toBeNull();
      expect(g.state.cards[one]?.zone, mode === 'ask' ? 'back in the hand' : 'back in the hand - not rewritten into the command zone').toEqual({ kind: 'hand', player: 'p1' });
      expect(g.state.cards[one]?.commanderCastCount, 'never cast').toBe(0);
      expect(asked(g)).toBe(0);
      replays(g);
    });
  }

  test('a foretold commander backed out of goes back to exile foretold, and owes no 903.9a choice (nothing asked at the next check)', () => {
    const g = table({ decks: [LANDS, ['Grizzly Bears', ...LANDS]], commanders: [['Demon Bolt'], ['Krenko, Mob Boss']] });
    const bolt = commanderOf(g, 'p1');
    const bears = put(g, 'p2', 'Grizzly Bears');
    toHand(g, bolt);
    mana(g, 'C', 2);
    must(g.submit({ t: 'Foretell', player: 'p1', card: bolt }));
    // The foretell itself is a zone change 903.9a asks about (hand to exile): its owner leaves it there.
    expect(g.state.priority.awaiting?.kind).toBe('commanderZoneChoice');
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p1', toCommandZone: false, always: false }));
    expect(g.state.cards[bolt]?.zone.kind).toBe('exile');
    expect(g.state.cards[bolt]?.foretoldTurn).toBe(1);
    main(g, 3);
    mana(g, 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    expect(g.state.pendingCast?.stage, 'cast from exile for its foretell cost, stopped at its target').toBe('targets');
    must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(g.state.priority.awaiting, 'the back-out owes nothing: no question at the next check').toBeNull();
    expect(g.state.cards[bolt]?.zone.kind).toBe('exile');
    expect(g.state.cards[bolt]?.faceDown, 'face down again').toBe(true);
    expect(g.state.cards[bolt]?.foretoldTurn, 'foretold on the turn it was').toBe(1);
    expect(g.state.cards[bolt]?.commanderZoneOwed).toBeUndefined();
    expect(asked(g), 'asked once - about the foretell, never about the undo').toBe(1);
    // ...and it is cast after all, from exile, for its foretell cost.
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[bears]?.zone.kind, 'four damage').toBe('graveyard');
    replays(g);
  });
});
