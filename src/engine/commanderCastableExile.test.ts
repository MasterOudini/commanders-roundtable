// Copy to src/engine/ (imports are relative to that folder).
//
// D587 - THE USER'S CHOICE (2026-09-29, FIX-LIST item 46): A STANDING "SEND IT HOME" STILL ASKS WHEN THE OWNER EXILED THE
// COMMANDER ON PURPOSE. 903.9a lets the owner move a commander put into exile to the command zone (CR 704.6d), and a
// standing answer - the player's "Always do this" yes, or the game's "always" option - does it unasked. But an exile the
// owner chose so as to cast the card from there (foretold, plotted, suspended, discarded to madness, warped) is the
// owner's own plan: on master aedb4001 the standing yes sent the commander home at once and the plan was gone. Now the
// owner is asked; "Leave it" keeps the card where it can be cast. (The engine has no "on an adventure" exile yet, CR
// 715.4 - an Adventure resolves to the graveyard - so there is nothing of it to test.) A graveyard is no such exile: the
// madness test ends with its cast backed out of, into the graveyard (the madness instruction's own move, not a reversal -
// see commanderBackOut.test.ts), and sent home by the standing answer unasked.
//
// Each test failed on aedb4001 at the first question; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import type { GameOptions } from './types/state';

const LANDS = ['Island', 'Island', 'Island', 'Forest', 'Forest', 'Forest'];

function table(commander: string, mode: GameOptions['commanderZoneReplacement'] = 'ask'): { g: Game; cmd: InstanceId } {
  const g = startedGame({ players: 2, decks: [LANDS, LANDS], commanders: [[commander], ['Krenko, Mob Boss']], options: { commanderZoneReplacement: mode, maxHandSize: null } });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, cmd: (g.state.zones.command.p1 ?? [])[0] as InstanceId };
}
const settle = (g: Game) =>
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const mana = (g: Game, symbol: 'U' | 'R' | 'G' | 'C', amount: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
const move = (g: Game, card: InstanceId, kind: 'battlefield' | 'graveyard' | 'hand') => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind, player: 'p1' } }));
const leaveIt = (g: Game) => must(g.submit({ t: 'CommanderZoneChoice', player: 'p1', toCommandZone: false, always: false }));
const asked = (g: Game) => g.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'commanderZoneChoice').length;
const replays = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

/** p1's own standing yes - "Always do this" on a 903.9a question - and the commander back in hand (not asked: it leaves the command zone). */
function standingYes(g: Game, cmd: InstanceId): void {
  move(g, cmd, 'battlefield');
  move(g, cmd, 'graveyard');
  expect(g.state.priority.awaiting?.kind).toBe('commanderZoneChoice');
  must(g.submit({ t: 'CommanderZoneChoice', player: 'p1', toCommandZone: true, always: true }));
  expect(g.state.cards[cmd]?.zone.kind).toBe('command');
  expect(g.state.players.p1?.commanderZoneAlways, 'the standing yes').toBe(true);
  move(g, cmd, 'hand');
  expect(g.state.cards[cmd]?.zone.kind).toBe('hand');
}

/** The 903.9a question about the commander, in exile - asked, not answered by the standing yes. */
function askedAbout(g: Game, cmd: InstanceId): void {
  const q = g.state.priority.awaiting;
  if (q?.kind !== 'commanderZoneChoice') throw new Error('expected the commander question - the standing yes sent it home - got ' + (q?.kind ?? 'none'));
  expect(q.player).toBe('p1');
  expect(q.queue[0]?.card).toBe(cmd);
  expect(q.queue[0]?.from.kind).toBe('exile');
  expect(q.instead, "903.9a's question, not 903.9b's").toBeUndefined();
  expect(g.state.cards[cmd]?.zone.kind, 'still in exile while it is asked').toBe('exile');
}

describe("the user's choice: a standing yes asks about a commander its owner exiled to cast it from there", () => {
  test('foretold (CR 702.143a): asked; "Leave it" keeps it foretold, and it is cast from exile for its foretell cost on a later turn', () => {
    const { g, cmd } = table('Augury Raven');
    standingYes(g, cmd);
    mana(g, 'C', 2);
    must(g.submit({ t: 'Foretell', player: 'p1', card: cmd }));
    askedAbout(g, cmd);
    leaveIt(g);
    expect(g.state.cards[cmd]?.zone.kind).toBe('exile');
    expect(g.state.cards[cmd]?.foretoldTurn).toBe(1);
    expect(g.state.players.p1?.commanderZoneAlways, 'the standing yes stands').toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    mana(g, 'U', 1);
    mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: cmd }));
    settle(g);
    expect(g.state.cards[cmd]?.zone.kind, 'cast from exile').toBe('battlefield');
    expect(asked(g), 'the setup question and the foretell').toBe(2);
    replays(g);
  });

  test('plotted (CR 702.170a): asked; "Leave it" keeps it plotted', () => {
    const { g, cmd } = table("Djinn of Fool's Fall");
    standingYes(g, cmd);
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    must(g.submit({ t: 'Plot', player: 'p1', card: cmd }));
    askedAbout(g, cmd);
    leaveIt(g);
    expect(g.state.cards[cmd]?.zone.kind).toBe('exile');
    expect(g.state.cards[cmd]?.plottedTurn).toBe(1);
    replays(g);
  });

  test('suspended (CR 702.62a): asked; "Leave it" keeps it suspended', () => {
    const { g, cmd } = table('Rift Sower');
    standingYes(g, cmd);
    mana(g, 'G', 1);
    must(g.submit({ t: 'Suspend', player: 'p1', card: cmd }));
    askedAbout(g, cmd);
    leaveIt(g);
    expect(g.state.cards[cmd]?.zone.kind).toBe('exile');
    expect(g.state.cards[cmd]?.suspended).toBe(true);
    replays(g);
  });

  test('warped (its end-step exile): asked; "Leave it" keeps it castable from exile', () => {
    const { g, cmd } = table('Bygone Colossus');
    standingYes(g, cmd);
    mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: cmd, alternative: true }));
    settle(g);
    expect(g.state.cards[cmd]?.zone.kind, 'cast from the hand for its warp cost').toBe('battlefield');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'commanderZoneChoice' || s.turn.turnNumber > 1, 20_000);
    askedAbout(g, cmd);
    expect(g.state.cards[cmd]?.warpedTurn).toBe(1);
    leaveIt(g);
    expect(g.state.cards[cmd]?.zone.kind).toBe('exile');
    replays(g);
  });

  test('discarded to madness (CR 702.35a) under the "always" option: asked; "Leave it" and the madness cast is offered - backed out of, its graveyard is a real move, sent home unasked', () => {
    const { g, cmd } = table('Fiery Temper', 'always');
    move(g, cmd, 'hand');
    // Its owner moving it from their hand to their graveyard is a discard (CR 701.8a): madness exiles it instead.
    move(g, cmd, 'graveyard');
    expect(g.state.cards[cmd]?.madnessExiled).toBe(true);
    askedAbout(g, cmd);
    leaveIt(g);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.madness !== undefined, 20_000);
    mana(g, 'R', 1);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [cmd] }));
    expect(g.state.pendingCast?.stage, 'cast for its madness cost, stopped at its target').toBe('targets');
    must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(g.state.cards[cmd]?.zone.kind, "the graveyard is madness's own move, owed its choice - and the option sends it home").toBe('command');
    expect(asked(g), 'asked once - about the madness exile').toBe(1);
    replays(g);
  });
});
