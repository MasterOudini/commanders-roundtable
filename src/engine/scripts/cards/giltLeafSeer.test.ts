// `Gilt-Leaf Seer` — {G} and the tap show me the top two and let me put
// them back in either order; the answer's first card ends up on top.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GILT_LEAF_SEER_SCRIPT } from './giltLeafSeer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SEER = 'Gilt-Leaf Seer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function looked(): { g: Game; seer: InstanceId; shown: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[SEER], []],
    scripts: createRegistry([GILT_LEAF_SEER_SCRIPT]),
  });
  const seer = put(g, 'p1', SEER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: seer, abilityIndex: 0, targets: [] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const shown = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, seer, shown };
}

describe('Gilt-Leaf Seer', () => {
  test('two cards are shown; the order I give is written to the top', () => {
    const { g, seer, shown } = looked();
    expect(shown.length).toBe(2);
    const [a, b] = shown as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [a, b] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(a);
    expect(lib[lib.length - 2]).toBe(b);
    expect(g.state.cards[seer]?.tapped).toBe(true);
  });

  test('the other order puts the other card on top', () => {
    const { g, shown } = looked();
    const [a, b] = shown as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [b, a] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(b);
    expect(lib[lib.length - 2]).toBe(a);
  });

  test('replays to the same hash', () => {
    const { g, shown } = looked();
    const [a, b] = shown as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [b, a] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
