// `Devotee of Strength` — the +2/+2 lands as a layer-7c modifier and cleanup
// takes it back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEVOTEE_OF_STRENGTH_SCRIPT } from './devoteeOfStrength';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DEVOTEE = 'Devotee of Strength';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumped(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DEVOTEE, BEARS], []],
    scripts: createRegistry([DEVOTEE_OF_STRENGTH_SCRIPT]),
  });
  const devotee = put(g, 'p1', DEVOTEE);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: devotee, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Devotee of Strength', () => {
  test('the modifier lands on the EVENT and cleanup removes it', () => {
    const { g, bears } = pumped();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === bears &&
          e.body.power === 2 &&
          e.body.toughness === 2,
      ),
    ).toBe(true);
    expect(g.state.untilEndOfTurn.some((m) => m.card === bears)).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(g.state.untilEndOfTurn.some((m) => m.card === bears)).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = pumped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
