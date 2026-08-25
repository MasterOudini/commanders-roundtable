// `Wildheart Invoker` — +5/+5 AND trample in one modification, gone at
// cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WILDHEART_INVOKER_SCRIPT } from './wildheartInvoker';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const INVOKER = 'Wildheart Invoker';
const BEARS = 'Grizzly Bears'; // 2/2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[INVOKER, BEARS], []],
    scripts: createRegistry([WILDHEART_INVOKER_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const invoker = put(g, 'p1', INVOKER);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: invoker, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

function look(g: Game, id: InstanceId) {
  const d = deps(createRegistry([WILDHEART_INVOKER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id);
}

describe('Wildheart Invoker', () => {
  test('the target is 7/7 and tramples', () => {
    const { g, bears } = granted();
    const got = look(g, bears);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 7, toughness: 7 });
    expect(got.keywords.has('trample')).toBe(true);
  });

  test('cleanup takes BOTH back (CR 514.2)', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const got = look(g, bears);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 2, toughness: 2 });
    expect(got.keywords.has('trample')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
