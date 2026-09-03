// `Halimar Depths` — enters tapped, shows me the top three and lets me put
// them back in any order.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HALIMAR_DEPTHS_SCRIPT } from './halimarDepths';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DEPTHS = 'Halimar Depths';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; depths: InstanceId; shown: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[DEPTHS], []],
    scripts: createRegistry([HALIMAR_DEPTHS_SCRIPT]),
  });
  const depths = put(g, 'p1', DEPTHS);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const shown = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, depths, shown };
}

describe('Halimar Depths', () => {
  test('it enters tapped and shows me three cards', () => {
    const { g, depths, shown } = placed();
    expect(g.state.cards[depths]?.tapped).toBe(true);
    expect(shown.length).toBe(3);
  });

  test('the order I give is written to the top, first card on top', () => {
    const { g, shown } = placed();
    const [a, b, c] = shown as [InstanceId, InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [c, a, b] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib.slice(lib.length - 3)).toEqual([b, a, c]);
  });

  test('replays to the same hash', () => {
    const { g, shown } = placed();
    const [a, b, c] = shown as [InstanceId, InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [c, a, b] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
