// `Goblin Sledder` — the Goblin-predicate chooser paying with ITSELF
// (CR 113.7a) for a +1/+1 pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_SLEDDER_SCRIPT } from './goblinSledder';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SLEDDER = 'Goblin Sledder';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumps(g: Game, card: InstanceId): number {
  return g.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === card).length;
}

function board(): { g: Game; sledder: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SLEDDER, BEARS], []],
    scripts: createRegistry([GOBLIN_SLEDDER_SCRIPT]),
  });
  const sledder = put(g, 'p1', SLEDDER);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, sledder, bears };
}

describe('Goblin Sledder', () => {
  test('sacrifices ITSELF — the Goblin predicate — and the pump still lands', () => {
    const { g, sledder, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: sledder,
        abilityIndex: 0,
        sacrifice: sledder,
      }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[sledder]?.zone.kind).toBe('graveyard');
    expect(pumps(g, bears)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, sledder, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: sledder,
        abilityIndex: 0,
        sacrifice: sledder,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
