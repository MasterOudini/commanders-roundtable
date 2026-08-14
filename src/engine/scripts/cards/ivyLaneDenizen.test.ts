// `Ivy Lane Denizen` — a GREEN creature of mine entering asks and grows the
// chosen creature; a white one pays nothing (the colour filter).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { IVY_LANE_DENIZEN_SCRIPT } from './ivyLaneDenizen';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DENIZEN = 'Ivy Lane Denizen';
const BEARS = 'Grizzly Bears';
const INFANTRY = 'Heavy Infantry';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; denizen: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DENIZEN, BEARS, INFANTRY], []],
    scripts: createRegistry([IVY_LANE_DENIZEN_SCRIPT]),
  });
  const denizen = put(g, 'p1', DENIZEN);
  settle(g);
  return { g, denizen };
}

describe('Ivy Lane Denizen', () => {
  test('a green creature of mine entering grows the chosen creature', () => {
    const { g, denizen } = board();
    put(g, 'p1', BEARS);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: denizen }] }));
    settle(g);
    expect(g.state.cards[denizen]?.counters['+1/+1']).toBe(1);
  });

  test('a WHITE creature of mine pays nothing — the colour filter holds', () => {
    const { g } = board();
    put(g, 'p1', INFANTRY);
    settle(g);
    expect(g.log.some((e) => e.body.t === 'CountersChanged' && e.cause.kind !== 'manual')).toBe(
      false,
    );
  });

  test('replays to the same hash', () => {
    const { g, denizen } = board();
    put(g, 'p1', BEARS);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: denizen }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
