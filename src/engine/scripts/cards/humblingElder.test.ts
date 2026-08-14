// `Humbling Elder` — entering saps a chosen OPPONENT creature's power; my
// own creature is refused by the spec.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HUMBLING_ELDER_SCRIPT } from './humblingElder';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ELDER = 'Humbling Elder';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function prompted(): { g: Game; theirs: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [ELDER, BEARS],
      [BEARS],
    ],
    scripts: createRegistry([HUMBLING_ELDER_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const mine = put(g, 'p1', BEARS);
  put(g, 'p1', ELDER);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, theirs, mine };
}

describe('Humbling Elder', () => {
  test("entering gives the chosen opponent's creature -2/-0", () => {
    const { g, theirs } = prompted();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === theirs &&
          e.body.power === -2 &&
          e.body.toughness === 0,
      ),
    ).toBe(true);
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
