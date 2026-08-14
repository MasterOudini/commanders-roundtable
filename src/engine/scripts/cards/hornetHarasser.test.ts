// `Hornet Harasser` — dying debuffs a chosen creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HORNET_HARASSER_SCRIPT } from './hornetHarasser';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HARASSER = 'Hornet Harasser';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HARASSER], [BEARS]],
    scripts: createRegistry([HORNET_HARASSER_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  const harasser = put(g, 'p1', HARASSER);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: harasser,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Hornet Harasser', () => {
  test('dying gives the chosen creature -2/-2', () => {
    const { g, bears } = answered();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.power === -2,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = answered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
