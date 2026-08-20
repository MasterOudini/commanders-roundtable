// `Mist Raven` — the entry asks for an aim and bounces to the OWNER's hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MIST_RAVEN_SCRIPT } from './mistRaven';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ravened(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mist Raven'], ['Grizzly Bears']],
    scripts: createRegistry([MIST_RAVEN_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Mist Raven');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Mist Raven', () => {
  test("the entry bounces the Bears to its owner's hand", () => {
    const { g, bears } = ravened();
    const card = g.state.cards[bears];
    expect(card?.zone.kind).toBe('hand');
    expect(card?.zone.kind === 'hand' && card.zone.player).toBe('p2');
  });

  test('replays to the same hash', () => {
    const { g } = ravened();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
