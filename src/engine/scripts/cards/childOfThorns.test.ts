// `Child of Thorns` — the mana-free self-sacrifice pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CHILD_OF_THORNS_SCRIPT } from './childOfThorns';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHILD = 'Child of Thorns';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; child: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CHILD, 'Grizzly Bears'], []],
    scripts: createRegistry([CHILD_OF_THORNS_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const child = put(g, 'p1', CHILD);
  settle(g);
  return { g, child, bears };
}

describe('Child of Thorns', () => {
  test('the +1/+1 lands with the Child spent as the cost', () => {
    const { g, child, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: child,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === bears &&
          e.body.power === 1 &&
          e.body.toughness === 1,
      ),
    ).toBe(true);
    expect(g.state.cards[child]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, child, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: child,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
