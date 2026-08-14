// `Goblin Replica` — {3}{R}, sacrifice itself: destroy target artifact.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_REPLICA_SCRIPT } from './goblinReplica';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const REPLICA = 'Goblin Replica';
const ARCHIVE = 'Hedron Archive';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; replica: InstanceId; archive: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[REPLICA], [ARCHIVE]],
    scripts: createRegistry([GOBLIN_REPLICA_SCRIPT]),
  });
  const replica = put(g, 'p1', REPLICA);
  const archive = put(g, 'p2', ARCHIVE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, replica, archive };
}

describe('Goblin Replica', () => {
  test('sacrifices itself to destroy the artifact', () => {
    const { g, replica, archive } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: replica,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: archive }],
      }),
    );
    settle(g);
    expect(g.state.cards[archive]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[replica]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, replica, archive } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: replica,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: archive }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
