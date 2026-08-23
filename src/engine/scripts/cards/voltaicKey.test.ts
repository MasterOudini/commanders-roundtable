// `Voltaic Key` — {1},{T} untaps an artifact, and an UNTAPPED one is not a
// legal thing to untap twice.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VOLTAIC_KEY_SCRIPT } from './voltaicKey';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KEY = 'Voltaic Key';
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; key: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KEY, RING], []],
    scripts: createRegistry([VOLTAIC_KEY_SCRIPT]),
  });
  const key = put(g, 'p1', KEY);
  const ring = put(g, 'p1', RING);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ring], tapped: true }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, key, ring };
}

describe('Voltaic Key', () => {
  test('the Key taps itself and the artifact comes up', () => {
    const { g, key, ring } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: key, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[ring]?.tapped).toBe(false);
    expect(g.state.cards[key]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, key, ring } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: key, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
