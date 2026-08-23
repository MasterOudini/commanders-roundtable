// `Théoden, King of Rohan` — the self-or-Human entry pair granting double
// strike. His OWN entry pays (self-inclusive), another Human pays, and a
// non-Human of mine pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THEODEN_KING_OF_ROHAN_SCRIPT } from './theodenKingOfRohan';
import { derive } from '../../derive';
import { advanceUntil, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const THEODEN = 'Théoden, King of Rohan';
const HUMAN = 'Benalish Trapper'; // Human Soldier
const NON_HUMAN = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Puts THEODEN down first (answering his own trigger at `aim`), then `then`. */
function game(then: string | null): { g: Game; aim: InstanceId; asked: boolean } {
  const g = startedGame({
    players: 2,
    decks: [[THEODEN, HUMAN, NON_HUMAN], []],
    scripts: createRegistry([THEODEN_KING_OF_ROHAN_SCRIPT]),
  });
  const aim = put(g, 'p1', NON_HUMAN);
  settle(g);
  put(g, 'p1', THEODEN);
  // His own entry is self-inclusive, so it asks.
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: aim }] }));
  settle(g);
  if (then === null) return { g, aim, asked: true };
  put(g, 'p1', then);
  const asked = g.state.priority.awaiting?.kind === 'chooseTargets';
  if (asked) {
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: aim }] }));
  }
  settle(g);
  return { g, aim, asked };
}

describe('Théoden, King of Rohan', () => {
  test('his OWN entry asks, and the target gains double strike', () => {
    const { g, aim } = game(null);
    expect(derive(g.state, ORACLE, g.deps.scripts, aim).keywords.has('doubleStrike')).toBe(true);
  });

  test('another HUMAN of mine asks again', () => {
    const { asked } = game(HUMAN);
    expect(asked).toBe(true);
  });

  test('a NON-Human of mine asks nothing', () => {
    const { asked } = game(NON_HUMAN);
    expect(asked).toBe(false);
  });

  test('the grant ends at cleanup, and it replays to the same hash', () => {
    const { g, aim } = game(null);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, aim).keywords.has('doubleStrike')).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
