// `Master Decoy` — the fifth id on the Benalish Trapper text taps a creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MASTER_DECOY_SCRIPT } from './masterDecoy';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DECOY = 'Master Decoy';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; decoy: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DECOY], ['Silvercoat Lion']],
    scripts: createRegistry([MASTER_DECOY_SCRIPT]),
  });
  const decoy = put(g, 'p1', DECOY);
  const theirs = put(g, 'p2', 'Silvercoat Lion');
  settle(g);
  // A creature's {T} waits out summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: decoy, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, decoy, theirs };
}

describe('Master Decoy', () => {
  test('taps the targeted creature', () => {
    const { g, theirs } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
