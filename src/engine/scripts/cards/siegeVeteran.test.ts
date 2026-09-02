// `Siege Veteran` — my beginning of combat aims a +1/+1 counter; a nontoken
// Soldier of mine dying is a Soldier token; the Veteran's own death is not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SIEGE_VETERAN_SCRIPT } from './siegeVeteran';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VETERAN = 'Siege Veteran';
const SOLDIER_CARD = 'Lossarnach Captain'; // Creature — Human Soldier
const BEARS = 'Grizzly Bears';
const SOLDIER = TOKEN_TABLE['Soldier|1/1||Artifact Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiersOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SOLDIER?.printingId;
  }).length;
}

function board(): { g: Game; veteran: InstanceId; captain: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VETERAN, SOLDIER_CARD, BEARS], []],
    scripts: createRegistry([SIEGE_VETERAN_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const captain = put(g, 'p1', SOLDIER_CARD);
  const veteran = put(g, 'p1', VETERAN);
  settle(g);
  return { g, veteran, captain, bears };
}

describe('Siege Veteran', () => {
  test('the beginning of each of my combats aims a +1/+1 counter', () => {
    const { g, bears } = board();
    // Turn 1's own beginning of combat comes first — the Veteran is already
    // on the battlefield — so the first ask is on turn 1, not turn 3.
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    expect(g.state.turn.turnNumber).toBe(1);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    // Turn 2 is the opponent's: no ask. Turn 3 asks again.
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(2);
  });

  test('a nontoken Soldier dying is a Soldier token; the Veteran itself is not', () => {
    const { g, veteran, captain } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: captain, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(soldiersOf(g, 'p1')).toBe(1);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: veteran, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(soldiersOf(g, 'p1')).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, captain } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: captain, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
