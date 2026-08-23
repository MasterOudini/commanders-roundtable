// `Tranquil Cove` — the refuge: it enters tapped and pays 1 life on the way.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TRANQUIL_COVE_SCRIPT } from './tranquilCove';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const COVE = 'Tranquil Cove';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; cove: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[COVE], []],
    scripts: createRegistry([TRANQUIL_COVE_SCRIPT]),
  });
  const cove = put(g, 'p1', COVE);
  settle(g);
  return { g, cove };
}

describe('Tranquil Cove', () => {
  test('it enters TAPPED and its controller gains 1', () => {
    const { g, cove } = entered();
    expect(g.state.cards[cove]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
