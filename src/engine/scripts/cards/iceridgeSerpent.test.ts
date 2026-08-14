// `Iceridge Serpent` — entering bounces a chosen opponent creature to its
// OWNER's hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ICERIDGE_SERPENT_SCRIPT } from './iceridgeSerpent';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SERPENT = 'Iceridge Serpent';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bounced(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SERPENT], [BEARS]],
    scripts: createRegistry([ICERIDGE_SERPENT_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  put(g, 'p1', SERPENT);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Iceridge Serpent', () => {
  test("entering returns the chosen creature to its owner's hand", () => {
    const { g, theirs } = bounced();
    const zone = g.state.cards[theirs]?.zone;
    expect(zone?.kind).toBe('hand');
    expect(zone?.kind === 'hand' && zone.player).toBe('p2');
  });

  test('replays to the same hash', () => {
    const { g } = bounced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
