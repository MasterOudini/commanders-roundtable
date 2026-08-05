// `Boltwing Marauder` — a friendly entry asks for a pump target; an
// opponent's entry asks nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOLTWING_MARAUDER_SCRIPT } from './boltwingMarauder';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MARAUDER = 'Boltwing Marauder';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; dragon: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [MARAUDER, 'Grizzly Bears'],
      ['Silvercoat Lion'],
    ],
    scripts: createRegistry([BOLTWING_MARAUDER_SCRIPT]),
  });
  const dragon = put(g, 'p1', MARAUDER);
  settle(g);
  return { g, dragon };
}

describe('Boltwing Marauder', () => {
  test('a friendly creature entering pumps the chosen target +2/+0', () => {
    const { g, dragon } = game();
    put(g, 'p1', 'Grizzly Bears');
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dragon }] }));
    settle(g);
    expect(
      g.log.some(
        (e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === dragon && e.body.power === 2,
      ),
    ).toBe(true);
  });

  test("an OPPONENT's creature entering triggers nothing", () => {
    const { g } = game();
    put(g, 'p2', 'Silvercoat Lion');
    settle(g);
    expect(g.log.some((e) => e.body.t === 'PtModifiedUntilEndOfTurn')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, dragon } = game();
    put(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dragon }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
