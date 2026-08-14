// `Kor Line-Slinger` — the tap taps a small creature; a power-6 one is
// refused by D139's ceiling.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KOR_LINE_SLINGER_SCRIPT } from './korLineSlinger';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SLINGER = 'Kor Line-Slinger';
const BEARS = 'Grizzly Bears';
const TITAN = 'Grave Titan';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; slinger: InstanceId; bears: InstanceId; titan: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SLINGER],
      [BEARS, TITAN],
    ],
    scripts: createRegistry([KOR_LINE_SLINGER_SCRIPT]),
  });
  const slinger = put(g, 'p1', SLINGER);
  const bears = put(g, 'p2', BEARS);
  const titan = put(g, 'p2', TITAN);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, slinger, bears, titan };
}

describe('Kor Line-Slinger', () => {
  test('the tap taps a power-2 creature', () => {
    const { g, slinger, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: slinger, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('a power-6 creature is refused — the numeric ceiling holds', () => {
    const { g, slinger, titan } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: slinger, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const r = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] });
    expect(r.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, slinger, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: slinger, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
