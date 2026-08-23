// `Thoughtweft Lieutenant` — +1/+1 AND trample from one carrier entry, on
// its own arrival and on another Kithkin's.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THOUGHTWEFT_LIEUTENANT_SCRIPT } from './thoughtweftLieutenant';
import { derive } from '../../derive';
import { advanceUntil, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LIEUTENANT = 'Thoughtweft Lieutenant';
const KITHKIN = 'Goldmeadow Harrier';
const OTHER = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(then: string | null): { g: Game; aim: InstanceId; asked: boolean } {
  const g = startedGame({
    players: 2,
    decks: [[LIEUTENANT, KITHKIN, OTHER], []],
    scripts: createRegistry([THOUGHTWEFT_LIEUTENANT_SCRIPT]),
  });
  const aim = put(g, 'p1', OTHER);
  settle(g);
  put(g, 'p1', LIEUTENANT);
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

describe('Thoughtweft Lieutenant', () => {
  test('its own entry grants +1/+1 AND trample from one entry', () => {
    const { g, aim } = game(null);
    const d = derive(g.state, ORACLE, g.deps.scripts, aim);
    expect(d.power).toBe(3);
    expect(d.toughness).toBe(3);
    expect(d.keywords.has('trample')).toBe(true);
  });

  test('another KITHKIN asks again', () => {
    expect(game(KITHKIN).asked).toBe(true);
  });

  test('a non-Kithkin asks nothing', () => {
    expect(game(OTHER).asked).toBe(false);
  });

  test('the grant ends at cleanup, and it replays to the same hash', () => {
    const { g, aim } = game(null);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    const d = derive(g.state, ORACLE, g.deps.scripts, aim);
    expect(d.power).toBe(2);
    expect(d.keywords.has('trample')).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
