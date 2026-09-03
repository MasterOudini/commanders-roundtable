// `Inkfathom Divers` — its entry shows me the top four and lets me put them
// back in any order.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { INKFATHOM_DIVERS_SCRIPT } from './inkfathomDivers';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DIVERS = 'Inkfathom Divers';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; shown: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[DIVERS], []],
    scripts: createRegistry([INKFATHOM_DIVERS_SCRIPT]),
  });
  put(g, 'p1', DIVERS);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const shown = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, shown };
}

describe('Inkfathom Divers', () => {
  test('four cards are shown and reordered as I say', () => {
    const { g, shown } = placed();
    expect(shown.length).toBe(4);
    const [a, b, c, d] = shown as [InstanceId, InstanceId, InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [d, c, b, a] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib.slice(lib.length - 4)).toEqual([a, b, c, d]);
  });

  test('replays to the same hash', () => {
    const { g, shown } = placed();
    const [a, b, c, d] = shown as [InstanceId, InstanceId, InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [b, a, d, c] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
