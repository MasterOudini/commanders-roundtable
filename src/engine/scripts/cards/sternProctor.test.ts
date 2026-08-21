// `Stern Proctor` — the ETB bounces an artifact to its owner's hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STERN_PROCTOR_SCRIPT } from './sternProctor';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function proctored(): { g: Game; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Stern Proctor'], ['Sol Ring']],
    scripts: createRegistry([STERN_PROCTOR_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Stern Proctor');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
  settle(g);
  return { g, ring };
}

describe('Stern Proctor', () => {
  test("the Sol Ring goes to its owner's hand", () => {
    const { g, ring } = proctored();
    expect(g.state.cards[ring]?.zone).toEqual({ kind: 'hand', player: 'p2' });
  });

  test('replays to the same hash', () => {
    const { g } = proctored();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
