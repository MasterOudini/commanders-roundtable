// `Captive Flame` — the repeatable pump: twice in one turn on the mana.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CAPTIVE_FLAME_SCRIPT } from './captiveFlame';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FLAME = 'Captive Flame';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; flame: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FLAME, 'Grizzly Bears'], []],
    scripts: createRegistry([CAPTIVE_FLAME_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const flame = put(g, 'p1', FLAME);
  settle(g);
  return { g, flame, bears };
}

function pumps(g: Game, card: InstanceId): number {
  return g.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === card).length;
}

describe('Captive Flame', () => {
  test('pumps twice in one turn — no tap in the cost', () => {
    const { g, flame, bears } = game();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: flame,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(pumps(g, bears)).toBe(1);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: flame,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(pumps(g, bears)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, flame, bears } = game();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: flame,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
