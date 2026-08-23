// `Unspeakable Symbol` — three life buys a counter, and the cost is the only
// limit: paid twice, it is six life and two counters.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { UNSPEAKABLE_SYMBOL_SCRIPT } from './unspeakableSymbol';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SYMBOL = 'Unspeakable Symbol';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; symbol: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SYMBOL, BEARS], []],
    scripts: createRegistry([UNSPEAKABLE_SYMBOL_SCRIPT]),
  });
  const symbol = put(g, 'p1', SYMBOL);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return { g, symbol, bears };
}

function pay(g: Game, symbol: InstanceId, bears: InstanceId): void {
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: symbol, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
}

describe('Unspeakable Symbol', () => {
  test('three life buys a +1/+1 counter, and no mana is spent', () => {
    const { g, symbol, bears } = game();
    pay(g, symbol, bears);
    expect(g.state.players.p1?.life).toBe(37);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
  });

  test('it can be paid twice — six life, two counters', () => {
    const { g, symbol, bears } = game();
    pay(g, symbol, bears);
    pay(g, symbol, bears);
    expect(g.state.players.p1?.life).toBe(34);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, symbol, bears } = game();
    pay(g, symbol, bears);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
