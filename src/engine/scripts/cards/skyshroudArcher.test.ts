// `Skyshroud Archer` — its own {T} (turn 3) gives their flyer -1/-1 until
// end of turn; a ground creature is refused (D289).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKYSHROUD_ARCHER_SCRIPT } from './skyshroudArcher';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Skyshroud Archer';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; hawk: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD], [HAWK, BEARS]], scripts: createRegistry([SKYSHROUD_ARCHER_SCRIPT]) });
  const self = put(g, 'p1', CARD);
  const hawk = put(g, 'p2', HAWK);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, hawk, bears };
}

describe('Skyshroud Archer', () => {
  test('the flyer is a 1/2 until end of turn', () => {
    const { g, hawk } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    const d = deps(createRegistry([SKYSHROUD_ARCHER_SCRIPT]));
    const got = derive(g.state, d.oracle, d.scripts, hawk);
    expect([got.power, got.toughness]).toEqual([1, 2]);
  });

  test('a ground creature is refused (D289)', () => {
    const { g, bears } = placed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, hawk } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
