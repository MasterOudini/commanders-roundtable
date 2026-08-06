// `Fan Bearer` — the colorless tap, past summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FAN_BEARER_SCRIPT } from './fanBearer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BEARER = 'Fan Bearer';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; bearer: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BEARER], [BEARS]],
    scripts: createRegistry([FAN_BEARER_SCRIPT]),
  });
  const bearer = put(g, 'p1', BEARER);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, bearer, theirs };
}

describe('Fan Bearer', () => {
  test('taps the target creature', () => {
    const { g, bearer, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bearer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, bearer, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bearer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
