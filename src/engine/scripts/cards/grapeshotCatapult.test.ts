// `Grapeshot Catapult` — its own {T} waits for turn 3, then pings their
// flyer for 1; a ground creature is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRAPESHOT_CATAPULT_SCRIPT } from './grapeshotCatapult';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Grapeshot Catapult';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; self: InstanceId; hawk: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD], [HAWK, BEARS]], scripts: createRegistry([GRAPESHOT_CATAPULT_SCRIPT]) });
  const self = put(g, 'p1', CARD);
  const hawk = put(g, 'p2', HAWK);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, self, hawk, bears };
}

describe('Grapeshot Catapult', () => {
  test('taps to deal 1 to the flyer', () => {
    const { g, self, hawk } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(g.state.cards[hawk]?.damage).toBe(1);
  });

  test('a ground creature is refused (D289)', () => {
    const { g, bears } = placed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, hawk } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
