// `Dazzling Ramparts` — {1}{W}, {T}: tap the chosen creature, past sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DAZZLING_RAMPARTS_SCRIPT } from './dazzlingRamparts';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RAMPARTS = 'Dazzling Ramparts';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; ramparts: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[RAMPARTS], [BEARS]],
    scripts: createRegistry([DAZZLING_RAMPARTS_SCRIPT]),
  });
  const ramparts = put(g, 'p1', RAMPARTS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, ramparts, theirs };
}

describe('Dazzling Ramparts', () => {
  test('the answer taps the chosen creature, and the Wall turns too', () => {
    const { g, ramparts, theirs } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ramparts, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
    expect(g.state.cards[ramparts]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, ramparts, theirs } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ramparts, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
