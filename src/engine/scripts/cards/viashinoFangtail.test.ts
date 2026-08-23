// `Viashino Fangtail` — the {T} ping, at a player and at a creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VIASHINO_FANGTAIL_SCRIPT } from './viashinoFangtail';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FANGTAIL = 'Viashino Fangtail';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; fangtail: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FANGTAIL], [BEARS]],
    scripts: createRegistry([VIASHINO_FANGTAIL_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  const fangtail = put(g, 'p1', FANGTAIL);
  settle(g);
  // Summoning sickness holds the {T} back until p1's next turn.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 20_000);
  return { g, fangtail, bears };
}

describe('Viashino Fangtail', () => {
  test('taps and deals 1 to an opponent', () => {
    const { g, fangtail } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fangtail, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[fangtail]?.tapped).toBe(true);
  });

  test('the same 1 damage marks a creature instead', () => {
    const { g, fangtail, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fangtail, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.damage).toBe(1);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g, fangtail } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fangtail, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
