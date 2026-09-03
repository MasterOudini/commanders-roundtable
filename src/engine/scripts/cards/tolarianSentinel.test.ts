// `Tolarian Sentinel` — blue mana, the tap and a discarded card return a
// permanent I control to my hand; the opponent's is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TOLARIAN_SENTINEL_SCRIPT } from './tolarianSentinel';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SENTINEL = 'Tolarian Sentinel';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; sentinel: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SENTINEL, BEARS], [BEARS]],
    scripts: createRegistry([TOLARIAN_SENTINEL_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const sentinel = put(g, 'p1', SENTINEL);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, sentinel, mine, theirs };
}

describe('Tolarian Sentinel', () => {
  test('{U}, {T}, discard a card: my bear returns to my hand', () => {
    const { g, sentinel, mine } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sentinel, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
  });

  test("the opponent's permanent is refused as the target", () => {
    const { g, sentinel, theirs } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sentinel, abilityIndex: 0, discard: [chosen] }));
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, sentinel, mine } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sentinel, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
