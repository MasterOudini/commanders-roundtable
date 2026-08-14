// `Grim Backwoods` — the sacrificed creature pays for the draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRIM_BACKWOODS_SCRIPT } from './grimBackwoods';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BACKWOODS = 'Grim Backwoods';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; backwoods: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BACKWOODS, BEARS], []],
    scripts: createRegistry([GRIM_BACKWOODS_SCRIPT]),
  });
  const backwoods = put(g, 'p1', BACKWOODS);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  return { g, backwoods, bears };
}

describe('Grim Backwoods', () => {
  test('the sacrificed creature pays for the draw', () => {
    const { g, backwoods, bears } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: backwoods,
        abilityIndex: 1,
        sacrifice: bears,
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, backwoods, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: backwoods,
        abilityIndex: 1,
        sacrifice: bears,
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
