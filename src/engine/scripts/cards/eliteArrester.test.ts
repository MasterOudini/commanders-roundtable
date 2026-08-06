// `Elite Arrester` — the mana-and-tap tap, past summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELITE_ARRESTER_SCRIPT } from './eliteArrester';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ARRESTER = 'Elite Arrester';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; arrester: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ARRESTER], [BEARS]],
    scripts: createRegistry([ELITE_ARRESTER_SCRIPT]),
  });
  const arrester = put(g, 'p1', ARRESTER);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, arrester, theirs };
}

describe('Elite Arrester', () => {
  test('taps the target creature', () => {
    const { g, arrester, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: arrester, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, arrester, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: arrester, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
