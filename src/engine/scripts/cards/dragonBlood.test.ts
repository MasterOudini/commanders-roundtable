// `Dragon Blood` — the counter lands, and the Blood stays for next time.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRAGON_BLOOD_SCRIPT } from './dragonBlood';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BLOOD = 'Dragon Blood';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; blood: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BLOOD, BEARS], []],
    scripts: createRegistry([DRAGON_BLOOD_SCRIPT]),
  });
  const blood = put(g, 'p1', BLOOD);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, blood, bears };
}

describe('Dragon Blood', () => {
  test('puts one +1/+1 counter on the target, with the Blood still there', () => {
    const { g, blood, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: blood, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    expect(g.state.cards[blood]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, blood, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: blood, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
