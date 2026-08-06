// `Dauntless Aven` — attacking asks, and the answer STRAIGHTENS a tapped
// creature of mine; an untapped pick gets no event.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DAUNTLESS_AVEN_SCRIPT } from './dauntlessAven';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const AVEN = 'Dauntless Aven';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; aven: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[AVEN, BEARS], []],
    scripts: createRegistry([DAUNTLESS_AVEN_SCRIPT]),
  });
  const aven = put(g, 'p1', AVEN);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  return { g, aven, bears };
}

describe('Dauntless Aven', () => {
  test('attacking asks, and the answer untaps my tapped bear', () => {
    const { g, aven, bears } = game();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: aven, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, aven, bears } = game();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: aven, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
