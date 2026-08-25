// `Whip Sergeant` — the haste grant, gone at cleanup, and repeatable because
// no {T} sits in the cost.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WHIP_SERGEANT_SCRIPT } from './whipSergeant';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SERGEANT = 'Whip Sergeant';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; sergeant: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SERGEANT, BEARS], []],
    scripts: createRegistry([WHIP_SERGEANT_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const sergeant = put(g, 'p1', SERGEANT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sergeant, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, sergeant, bears };
}

function keywords(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([WHIP_SERGEANT_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

describe('Whip Sergeant', () => {
  test('the target gains haste, and the Sergeant does NOT tap', () => {
    const { g, sergeant, bears } = granted();
    expect(keywords(g, bears).has('haste')).toBe(true);
    expect(g.state.cards[sergeant]?.tapped).toBe(false);
  });

  test('cleanup takes it back (CR 514.2)', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(keywords(g, bears).has('haste')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
