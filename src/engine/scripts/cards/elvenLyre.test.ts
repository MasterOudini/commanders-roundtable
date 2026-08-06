// `Elven Lyre` — the +2/+2 lands with the Lyre spent on the answer.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELVEN_LYRE_SCRIPT } from './elvenLyre';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LYRE = 'Elven Lyre';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; lyre: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LYRE, BEARS], []],
    scripts: createRegistry([ELVEN_LYRE_SCRIPT]),
  });
  const lyre = put(g, 'p1', LYRE);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, lyre, bears };
}

describe('Elven Lyre', () => {
  test('the +2/+2 lands with the Lyre spent as part of the cost', () => {
    const { g, lyre, bears } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lyre, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.cards[lyre]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === bears &&
          e.body.power === 2 &&
          e.body.toughness === 2,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, lyre, bears } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lyre, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
