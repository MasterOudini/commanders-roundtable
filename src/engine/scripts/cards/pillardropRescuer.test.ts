// `Pillardrop Rescuer` — the entry buys back a cheap creature card; a
// six-drop is over the floor.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PILLARDROP_RESCUER_SCRIPT } from './pillardropRescuer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rescued(): { g: Game; bears: InstanceId; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Pillardrop Rescuer', 'Grizzly Bears', 'Colossal Dreadmaw'], []],
    scripts: createRegistry([PILLARDROP_RESCUER_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  const dreadmaw = put(g, 'p1', 'Colossal Dreadmaw', 'graveyard');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Pillardrop Rescuer');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  return { g, bears, dreadmaw };
}

describe('Pillardrop Rescuer', () => {
  test('mana value two comes back; mana value six is refused', () => {
    const { g, bears, dreadmaw } = rescued();
    const over = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dreadmaw }] });
    expect(over.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bears } = rescued();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
