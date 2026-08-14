// `Grim Physician` — dying debuffs a chosen enemy creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRIM_PHYSICIAN_SCRIPT } from './grimPhysician';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PHYSICIAN = 'Grim Physician';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; physician: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PHYSICIAN], [BEARS]],
    scripts: createRegistry([GRIM_PHYSICIAN_SCRIPT]),
  });
  const physician = put(g, 'p1', PHYSICIAN);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  return { g, physician, theirs };
}

describe('Grim Physician', () => {
  test("dying gives the chosen opponent's creature -1/-1", () => {
    const { g, physician, theirs } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: physician, to: { kind: 'graveyard', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === theirs && e.body.power === -1,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, physician, theirs } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: physician, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
