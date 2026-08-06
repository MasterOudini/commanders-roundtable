// `Disease Carriers` — the dies-trigger asks for a target, and the -2/-2
// kills a 2/2 through the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DISEASE_CARRIERS_SCRIPT } from './diseaseCarriers';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARRIERS = 'Disease Carriers';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARRIERS], [BEARS]],
    scripts: createRegistry([DISEASE_CARRIERS_SCRIPT]),
  });
  const carriers = put(g, 'p1', CARRIERS);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: carriers, to: { kind: 'graveyard', player: 'p1' } }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Disease Carriers', () => {
  test('the -2/-2 lands and the SBA kills the 2/2 target', () => {
    const { g, bears } = died();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === bears &&
          e.body.power === -2 &&
          e.body.toughness === -2,
      ),
    ).toBe(true);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
