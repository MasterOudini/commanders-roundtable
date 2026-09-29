// Copy to src/engine/ (imports are relative to that folder).
//
// D587 - THE 903.9a STATE-BASED QUESTION: WHO IS ASKED, AND IN WHAT ORDER (FIX-LIST items 4 and 5; the review's commander
// F6 and the cross-branch X13). A commander put into a graveyard or exile is owed its owner's choice at the next
// state-based check (CR 704.6d). On master aedb4001 that pass:
//
// - asked a player the SAME pass made lose (it read `hasLost` off the state before the pass): CR 704.3 performs the loss
//   and the choice at once, and a player who leaves the game takes their objects with them (CR 800.4a) - the choice is
//   moot, and a 3-4 player game waited on an eliminated seat;
// - built its queue in SEATING order from p1: CR 101.4 has the active player choose first, then the others in turn order
//   (APNAP) - on p2's turn a wrath asked p1 first.
//
// Each test failed on aedb4001; the replay hash on each. The harness answers any question for any seat, so the prompt is
// read directly rather than trusted to hang.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { SIP_OF_HEMLOCK_SCRIPT } from './scripts/cards/sipOfHemlock';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { PlayerId } from './types/ids';

const mainOf = (g: Game, who: PlayerId) =>
  advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.activePlayer === who && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null, 20_000);
const untilAsked = (g: Game) =>
  advanceUntil(g, (s) => s.priority.awaiting !== null || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
const replays = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

describe('F6 - a player who loses in the same state-based pass is not asked about their commander', () => {
  test('Sip of Hemlock kills a commander and drains its owner to 0 in one resolution: the owner loses and is not asked (CR 704.3, 800.4a)', () => {
    const g = startedGame({ players: 3, decks: [['Sip of Hemlock'], [], []], scripts: createRegistry([SIP_OF_HEMLOCK_SCRIPT]), options: { maxHandSize: null } });
    holdEverywhere(g);
    mainOf(g, 'p1');
    const krenko = put(g, 'p2', 'Krenko, Mob Boss');
    must(g.submit({ t: 'ManualSetLife', player: 'p2', target: 'p2', delta: 2 - (g.state.players.p2?.life ?? 0) }));
    expect(g.state.players.p2?.life).toBe(2);
    const spell = put(g, 'p1', 'Sip of Hemlock', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: krenko }] }));
    untilAsked(g);
    expect(g.state.players.p2?.hasLost, 'p2 lost to 0 life').toBe(true);
    expect(g.state.cards[krenko]?.zone.kind, 'Krenko died in the same resolution').toBe('graveyard');
    const q = g.state.priority.awaiting;
    expect(q?.kind === 'commanderZoneChoice' ? q.player : null, 'nobody asks a player who has left the game').toBeNull();
    expect(g.state.gamePhase, 'two players remain').toBe('playing');
    expect(g.state.priority.player, 'play goes on: the active player has priority').toBe('p1');
    replays(g);
  });
});

describe('X13 - several owed commanders are asked in APNAP order (CR 101.4)', () => {
  test("on p2's turn a wrath kills p1's and p2's commanders: p2, the active player, is asked first, then p1", () => {
    const g = startedGame({ players: 2, startingPlayer: 'p2', decks: [[], ['Wrath of God']], options: { maxHandSize: null } });
    holdEverywhere(g);
    mainOf(g, 'p2');
    const kess = put(g, 'p1', 'Kess, Dissident Mage');
    const krenko = put(g, 'p2', 'Krenko, Mob Boss');
    const wrath = put(g, 'p2', 'Wrath of God', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: wrath }));
    untilAsked(g);
    expect(g.state.cards[kess]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[krenko]?.zone.kind).toBe('graveyard');
    const first = g.state.priority.awaiting;
    if (first?.kind !== 'commanderZoneChoice') throw new Error("expected the commander's question, got " + (first?.kind ?? 'none'));
    expect(first.player, 'the active player first').toBe('p2');
    expect(first.queue.map((e) => e.card), 'the queue in APNAP order').toEqual([krenko, kess]);
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p2', toCommandZone: true, always: false }));
    const second = g.state.priority.awaiting;
    if (second?.kind !== 'commanderZoneChoice') throw new Error("expected the second commander's question, got " + (second?.kind ?? 'none'));
    expect(second.player, 'then the next player in turn order').toBe('p1');
    expect(second.queue[0]?.card).toBe(kess);
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p1', toCommandZone: false, always: false }));
    expect(g.state.cards[krenko]?.zone.kind).toBe('command');
    expect(g.state.cards[kess]?.zone.kind).toBe('graveyard');
    expect(g.state.priority.awaiting?.kind ?? null).not.toBe('commanderZoneChoice');
    replays(g);
  });
});
