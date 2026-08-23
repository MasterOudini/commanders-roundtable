// `Viashino Bladescout` — the entry hands out first strike, and cleanup takes
// it back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VIASHINO_BLADESCOUT_SCRIPT } from './viashinoBladescout';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SCOUT = 'Viashino Bladescout';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SCOUT, BEARS], []],
    scripts: createRegistry([VIASHINO_BLADESCOUT_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  put(g, 'p1', SCOUT);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

function keywords(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([VIASHINO_BLADESCOUT_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

describe('Viashino Bladescout', () => {
  test('the target gains first strike', () => {
    const { g, bears } = entered();
    expect(keywords(g, bears).has('firstStrike')).toBe(true);
  });

  test('cleanup takes it back (CR 514.2)', () => {
    const { g, bears } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(keywords(g, bears).has('firstStrike')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
