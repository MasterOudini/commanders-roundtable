// `Ghitu War Cry` — Captive Flame's exact text, proven on THIS oracle id
// (the Benalish rule).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GHITU_WAR_CRY_SCRIPT } from './ghituWarCry';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WAR_CRY = 'Ghitu War Cry';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumps(g: Game, card: InstanceId): number {
  return g.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === card).length;
}

function board(): { g: Game; warCry: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WAR_CRY, BEARS], []],
    scripts: createRegistry([GHITU_WAR_CRY_SCRIPT]),
  });
  const warCry = put(g, 'p1', WAR_CRY);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, warCry, bears };
}

describe('Ghitu War Cry', () => {
  test('pumps the target +1/+0', () => {
    const { g, warCry, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: warCry,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(pumps(g, bears)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, warCry, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: warCry,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
