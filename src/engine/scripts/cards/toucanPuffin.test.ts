// `Toucan-Puffin` — the targeted ETB pump, with the "you control" clause
// refused from the other side and the cleanup taking it back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { TOUCAN_PUFFIN_SCRIPT } from './toucanPuffin';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PUFFIN = 'Toucan-Puffin';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function landed(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PUFFIN, BEARS], [BEARS]],
    scripts: createRegistry([TOUCAN_PUFFIN_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  put(g, 'p1', PUFFIN);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, mine, theirs };
}

describe('Toucan-Puffin', () => {
  test('my own creature gets +2/+0, and the cleanup ends it', () => {
    const { g, mine } = landed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).toughness).toBe(2);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(2);
  });

  test("an OPPONENT's creature is refused — the clause says you control", () => {
    const { g, theirs } = landed();
    const res = g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: theirs }],
    });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, mine } = landed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
