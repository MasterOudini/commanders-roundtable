// `Goblin Assault Team` — dying asks for a creature I control and pays it a
// +1/+1 counter through the trigger's own target prompt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_ASSAULT_TEAM_SCRIPT } from './goblinAssaultTeam';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TEAM = 'Goblin Assault Team';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; team: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TEAM, BEARS], []],
    scripts: createRegistry([GOBLIN_ASSAULT_TEAM_SCRIPT]),
  });
  const team = put(g, 'p1', TEAM);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, team, bears };
}

describe('Goblin Assault Team', () => {
  test('dying pays a +1/+1 counter to the chosen creature I control', () => {
    const { g, team, bears } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: team, to: { kind: 'graveyard', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, team, bears } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: team, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
