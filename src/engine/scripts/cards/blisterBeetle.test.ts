// `Blister Beetle` — the -1/-1 lands as a layer-7c modifier and cleanup
// takes it back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLISTER_BEETLE_SCRIPT } from './blisterBeetle';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BEETLE = 'Blister Beetle';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BEETLE], ['Grizzly Bears']],
    scripts: createRegistry([BLISTER_BEETLE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const beetle = put(g, 'p1', BEETLE, 'graveyard');
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: beetle,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Blister Beetle', () => {
  test('the modifier lands on the EVENT and cleanup removes it', () => {
    const { g, bears } = board();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === bears &&
          e.body.power === -1 &&
          e.body.toughness === -1,
      ),
    ).toBe(true);
    expect(g.state.untilEndOfTurn.some((m) => m.card === bears)).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(g.state.untilEndOfTurn.some((m) => m.card === bears)).toBe(false);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
