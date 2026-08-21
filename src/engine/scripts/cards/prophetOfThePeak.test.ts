// `Prophet of the Peak` — the entry shows two and the answer splits them.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PROPHET_OF_THE_PEAK_SCRIPT } from './prophetOfThePeak';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function prophesied(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Prophet of the Peak'], []],
    scripts: createRegistry([PROPHET_OF_THE_PEAK_SCRIPT]),
  });
  put(g, 'p1', 'Prophet of the Peak');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Prophet of the Peak', () => {
  test('reveals two; one kept up, one bottomed at index 0', () => {
    const { g, revealed } = prophesied();
    expect(revealed).toHaveLength(2);
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [a], toBottom: [b] }));
    settle(g);
    expect(g.state.zones.library['p1']?.[0]).toBe(b);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(a);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = prophesied();
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [a, b], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
