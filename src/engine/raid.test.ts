// D340 - RAID: "When this creature enters, if you attacked this turn, ..." reads
// `TurnState.attacked` - set by a declaration of one or more attackers,
// cleared as a turn begins. Entering before any attack does nothing; entering
// after one fires; the memory does not carry into the next turn. Proven on
// Storm Fleet Spy (draw a card), a generated row.
import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registryCore';
import { STORM_FLEET_SPY_SCRIPT } from './scripts/cards/stormFleetSpy';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
const hand = (g: Game): number => (g.state.zones.hand.p1 ?? []).length;

/** A Bears on p1's board and the Spy in p1's graveyard, at p1's third-turn main phase. */
function board(): { g: Game; spy: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Storm Fleet Spy', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([STORM_FLEET_SPY_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  const spy = put(g, 'p1', 'Storm Fleet Spy', 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, spy, bears };
}
function enter(g: Game, spy: InstanceId): void {
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: spy, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
}
function attackWith(g: Game, bears: InstanceId): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}

describe('D340 - raid', () => {
  test('entering before any attack this turn does nothing', () => {
    const { g, spy } = board();
    expect(g.state.turn.attacked).toBe(false);
    const hand0 = hand(g);
    enter(g, spy);
    expect(hand(g)).toBe(hand0);
  });

  test('entering after an attack this turn fires', () => {
    const { g, spy, bears } = board();
    attackWith(g, bears);
    expect(g.state.turn.attacked).toBe(true);
    const hand0 = hand(g);
    enter(g, spy);
    expect(hand(g)).toBe(hand0 + 1);
  });

  test('the memory does not carry into the next turn', () => {
    const { g, spy, bears } = board();
    attackWith(g, bears);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(g.state.turn.attacked).toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
    const hand0 = hand(g);
    enter(g, spy);
    expect(hand(g)).toBe(hand0);
  });
});
