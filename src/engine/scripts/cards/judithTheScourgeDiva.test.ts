// `Judith, the Scourge Diva` - +1/+0 reaches its controller's OTHER creature and
// not the opponent's; a nontoken creature dying deals 1 to the declared player or
// creature; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JUDITH_THE_SCOURGE_DIVA_SCRIPT } from './judithTheScourgeDiva';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Judith, the Scourge Diva';
const EEL = 'Coral Eel'; // 2/1
const CYCLOPS = 'Cyclops of One-Eyed Pass'; // 5/2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([JUDITH_THE_SCOURGE_DIVA_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; eel: InstanceId; cyclops: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, EEL], [CYCLOPS]], scripts: createRegistry([JUDITH_THE_SCOURGE_DIVA_SCRIPT]) });
  holdEverywhere(g);
  const eel = put(g, 'p1', EEL);
  const cyclops = put(g, 'p2', CYCLOPS);
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, eel, cyclops };
}

describe('Judith, the Scourge Diva', () => {
  test('Coral Eel is reached, Cyclops of One-Eyed Pass is not, and Judith herself is not', () => {
    const { g, self, eel, cyclops } = board();
    expect(pt(g, eel)).toEqual([3, 1]);
    expect(pt(g, cyclops)).toEqual([5, 2]);
    expect(pt(g, self)).toEqual([2, 2]);
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, eel } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, eel)).toEqual([2, 1]);
  });

  test('a nontoken creature dying deals 1 damage to the declared opponent', () => {
    const { g, eel } = board();
    const p2Life = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: eel, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(p2Life - 1);
  });

  test('a nontoken creature dying deals 1 damage to the declared creature', () => {
    const { g, eel, cyclops } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: eel, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[cyclops]?.damage ?? 0).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, eel } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: eel, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
