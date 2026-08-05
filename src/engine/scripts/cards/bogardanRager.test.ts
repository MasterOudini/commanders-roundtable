// `Bogardan Rager` — the ETB +4/+0, on the event.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOGARDAN_RAGER_SCRIPT } from './bogardanRager';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RAGER = 'Bogardan Rager';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[RAGER, 'Grizzly Bears'], []],
    scripts: createRegistry([BOGARDAN_RAGER_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  const rager = put(g, 'p1', RAGER, 'graveyard');
  settle(g);
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: rager, to: { kind: 'battlefield', player: 'p1' } }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Bogardan Rager', () => {
  test('entering gives the chosen creature +4/+0 until end of turn', () => {
    const { g, bears } = board();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === bears &&
          e.body.power === 4 &&
          e.body.toughness === 0,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
