// `Myr Matrix` - {5} makes a Myr token, which the anthem lifts to 2/2 while the
// Matrix stays; a non-Myr is not lifted; the anthem ends when it leaves; replay
// equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MYR_MATRIX_SCRIPT } from './myrMatrix';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Myr Matrix';
const EEL = 'Coral Eel'; // Fish 2/1

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([MYR_MATRIX_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; eel: InstanceId; myr: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, EEL], [EEL]], scripts: createRegistry([MYR_MATRIX_SCRIPT]) });
  holdEverywhere(g);
  const eel = put(g, 'p1', EEL);
  const self = put(g, 'p1', CARD);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const before = new Set(Object.keys(g.state.cards));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  settle(g);
  const made = Object.values(g.state.cards).filter((c) => !before.has(c.id) && c.zone.kind === 'battlefield' && c.controller === 'p1');
  const myr = made[0]?.id as InstanceId;
  return { g, self, eel, myr };
}

describe('Myr Matrix', () => {
  test('{5} makes a Myr token, lifted to 2/2; the Eel is not lifted', () => {
    const { g, eel, myr } = board();
    expect(myr).toBeDefined();
    expect(pt(g, myr)).toEqual([2, 2]);
    expect(pt(g, eel)).toEqual([2, 1]);
  });

  test('the anthem ends when the Matrix leaves the battlefield', () => {
    const { g, self, myr } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, myr)).toEqual([1, 1]);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
