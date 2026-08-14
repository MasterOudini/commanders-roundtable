// `Heavy Infantry` — entering taps a chosen OPPONENT creature; my own
// creature is refused by the spec.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HEAVY_INFANTRY_SCRIPT } from './heavyInfantry';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const INFANTRY = 'Heavy Infantry';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function prompted(): { g: Game; theirs: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [INFANTRY, BEARS],
      [BEARS],
    ],
    scripts: createRegistry([HEAVY_INFANTRY_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const mine = put(g, 'p1', BEARS);
  put(g, 'p1', INFANTRY);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, theirs, mine };
}

describe('Heavy Infantry', () => {
  test("entering taps the chosen opponent's creature", () => {
    const { g, theirs } = prompted();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('my own creature is refused — the opponent restriction holds', () => {
    const { g, mine } = prompted();
    const r = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] });
    expect(r.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = prompted();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
