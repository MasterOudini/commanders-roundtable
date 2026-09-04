// `Diregraf Captain` - +1/+1 reaches its controller's OTHER Zombie and not a
// non-Zombie; a Zombie dying drains the declared opponent (the controller is
// refused); a non-Zombie dying asks nothing; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DIREGRAF_CAPTAIN_SCRIPT } from './diregrafCaptain';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Diregraf Captain';
const CORPSE = 'Walking Corpse'; // Zombie 2/2
const EEL = 'Coral Eel'; // Fish 2/1

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([DIREGRAF_CAPTAIN_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; corpse: InstanceId; eel: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, CORPSE, EEL], [EEL]], scripts: createRegistry([DIREGRAF_CAPTAIN_SCRIPT]) });
  holdEverywhere(g);
  const corpse = put(g, 'p1', CORPSE);
  const eel = put(g, 'p1', EEL);
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, corpse, eel };
}

describe('Diregraf Captain', () => {
  test('Walking Corpse is reached, Coral Eel is not, and the Captain itself is not', () => {
    const { g, self, corpse, eel } = board();
    expect(pt(g, corpse)).toEqual([3, 3]);
    expect(pt(g, eel)).toEqual([2, 1]);
    expect(pt(g, self)).toEqual([2, 2]);
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, corpse } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, corpse)).toEqual([2, 2]);
  });

  test('another Zombie dying drains the declared opponent; the controller is refused', () => {
    const { g, corpse } = board();
    const p2Life = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: corpse, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(p2Life - 1);
  });

  test('a non-Zombie dying asks nothing', () => {
    const { g, eel } = board();
    const p2Life = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: eel, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseTargets');
    expect(g.state.players.p2?.life).toBe(p2Life);
  });

  test('replays to the same hash', () => {
    const { g, corpse } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: corpse, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
