// `Plumecreed Mentor` — its own entry and a later flyer of mine each put a
// counter on my ground creature; their flyer entering does nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PLUMECREED_MENTOR_SCRIPT } from './plumecreedMentor';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Plumecreed Mentor';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function power(g: Game, id: InstanceId): number | null {
  const d = deps(createRegistry([PLUMECREED_MENTOR_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).power;
}

function enters(g: Game, player: 'p1' | 'p2', name: string): InstanceId {
  const id = put(g, player, name, 'graveyard');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player, card: id, to: { kind: 'battlefield', player } }));
  return id;
}

function mentored(): { g: Game; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS, HAWK], [HAWK]], scripts: createRegistry([PLUMECREED_MENTOR_SCRIPT]) });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  enters(g, 'p1', CARD);
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Plumecreed Mentor', () => {
  test('its own entry puts the first counter; my flyer entering puts the second', () => {
    const { g, bears } = mentored();
    expect(power(g, bears)).toBe(3);
    enters(g, 'p1', HAWK);
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(power(g, bears)).toBe(4);
  });

  test('their flyer entering does nothing', () => {
    const { g, bears } = mentored();
    enters(g, 'p2', HAWK);
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(power(g, bears)).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g } = mentored();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
