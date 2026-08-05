// `Ashen Rider` — one printed line, two defs, and both halves are driven in
// one game: the entry exiles a permanent, the death exiles another.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ASHEN_RIDER_SCRIPT } from './ashenRider';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RIDER = 'Ashen Rider';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; rider: InstanceId; lions: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[RIDER], ['Silvercoat Lion', 'Silvercoat Lion']],
    scripts: createRegistry([ASHEN_RIDER_SCRIPT]),
  });
  const lions = [put(g, 'p2', 'Silvercoat Lion'), put(g, 'p2', 'Silvercoat Lion')];
  settle(g);
  const rider = put(g, 'p1', RIDER, 'graveyard');
  settle(g);
  return { g, rider, lions };
}

function answer(g: Game, target: InstanceId): void {
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

describe('Ashen Rider', () => {
  test('ENTERING exiles the chosen permanent; DYING exiles another', () => {
    const { g, rider, lions } = board();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: rider,
        to: { kind: 'battlefield', player: 'p1' },
      }),
    );
    answer(g, lions[0] as InstanceId);
    expect(g.state.cards[lions[0] as InstanceId]?.zone.kind).toBe('exile');

    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: rider,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    answer(g, lions[1] as InstanceId);
    expect(g.state.cards[lions[1] as InstanceId]?.zone.kind).toBe('exile');
  });

  test('replays to the same hash', () => {
    const { g, rider, lions } = board();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: rider,
        to: { kind: 'battlefield', player: 'p1' },
      }),
    );
    answer(g, lions[0] as InstanceId);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
