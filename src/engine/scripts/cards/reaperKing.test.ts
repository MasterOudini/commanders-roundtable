// `Reaper King` - +1/+1 reaches its controller's OTHER Scarecrow and not a
// non-Scarecrow; another Scarecrow entering destroys the declared permanent; a
// non-Scarecrow entering asks nothing; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REAPER_KING_SCRIPT } from './reaperKing';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Reaper King';
const STRAW = 'Straw Soldiers'; // Scarecrow 1/3
const EEL = 'Coral Eel'; // Fish 2/1

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([REAPER_KING_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; eel: InstanceId; theirEel: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, STRAW, EEL], [EEL]], scripts: createRegistry([REAPER_KING_SCRIPT]) });
  holdEverywhere(g);
  const eel = put(g, 'p1', EEL);
  const theirEel = put(g, 'p2', EEL);
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, eel, theirEel };
}

describe('Reaper King', () => {
  test('Straw Soldiers is reached once it is in, Coral Eel is not', () => {
    const { g, self, eel, theirEel } = board();
    const straw = put(g, 'p1', STRAW);
    // Its entering asks for the destroy target; aim it at the opponent's Eel.
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirEel }] }));
    settle(g);
    expect(pt(g, straw)).toEqual([2, 4]);
    expect(pt(g, eel)).toEqual([2, 1]);
    expect(pt(g, self)).toEqual([6, 6]);
    expect(g.state.cards[theirEel]?.zone.kind).toBe('graveyard');
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, theirEel } = board();
    const straw = put(g, 'p1', STRAW);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirEel }] }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, straw)).toEqual([1, 3]);
  });

  test('a non-Scarecrow entering asks nothing', () => {
    const g = startedGame({ players: 2, decks: [[CARD, EEL], [EEL]], scripts: createRegistry([REAPER_KING_SCRIPT]) });
    holdEverywhere(g);
    put(g, 'p1', CARD);
    settle(g);
    put(g, 'p1', EEL);
    settle(g);
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseTargets');
  });

  test('replays to the same hash', () => {
    const { g, theirEel } = board();
    put(g, 'p1', STRAW);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirEel }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
