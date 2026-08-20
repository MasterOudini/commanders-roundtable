// `Lost Legion` — the ETB scry 2, split both ways.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LOST_LEGION_SCRIPT } from './lostLegion';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function marched(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Lost Legion'], ['Grizzly Bears']],
    scripts: createRegistry([LOST_LEGION_SCRIPT]),
  });
  settle(g);
  put(g, 'p1', 'Lost Legion');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Lost Legion', () => {
  test('the entry reveals TWO; one kept, one bottomed', () => {
    const { g, revealed } = marched();
    expect(revealed).toHaveLength(2);
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[0]).toBe(a);
    expect(lib[lib.length - 1]).toBe(b);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = marched();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed].reverse(), toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
