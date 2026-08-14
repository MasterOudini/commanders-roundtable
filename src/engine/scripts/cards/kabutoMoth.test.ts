// `Kabuto Moth` — the tap gives the chosen creature +1/+2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KABUTO_MOTH_SCRIPT } from './kabutoMoth';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MOTH = 'Kabuto Moth';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumped(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MOTH, BEARS], []],
    scripts: createRegistry([KABUTO_MOTH_SCRIPT]),
  });
  const moth = put(g, 'p1', MOTH);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: moth, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Kabuto Moth', () => {
  test('the tap gives the chosen creature +1/+2', () => {
    const { g, bears } = pumped();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === bears &&
          e.body.power === 1 &&
          e.body.toughness === 2,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = pumped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
