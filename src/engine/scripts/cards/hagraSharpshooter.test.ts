// `Hagra Sharpshooter` — the {4}{B} repeatable debuff.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HAGRA_SHARPSHOOTER_SCRIPT } from './hagraSharpshooter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SHARPSHOOTER = 'Hagra Sharpshooter';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; sharpshooter: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SHARPSHOOTER], [BEARS]],
    scripts: createRegistry([HAGRA_SHARPSHOOTER_SCRIPT]),
  });
  const sharpshooter = put(g, 'p1', SHARPSHOOTER);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, sharpshooter, bears };
}

describe('Hagra Sharpshooter', () => {
  test('gives the target -1/-1 until end of turn', () => {
    const { g, sharpshooter, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: sharpshooter,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.power === -1,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, sharpshooter, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: sharpshooter,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
