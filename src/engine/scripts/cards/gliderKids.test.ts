// `Glider Kids` — the ETB scry 1: one card revealed, and bottoming it
// really puts it under the library.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GLIDER_KIDS_SCRIPT } from './gliderKids';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function glided(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Glider Kids'], ['Grizzly Bears']],
    scripts: createRegistry([GLIDER_KIDS_SCRIPT]),
  });
  settle(g);
  put(g, 'p1', 'Glider Kids');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Glider Kids', () => {
  test('the entry reveals the top card and bottoming it lands at index 0', () => {
    const { g, revealed } = glided();
    const lib = g.state.zones.library['p1'] ?? [];
    expect(revealed).toHaveLength(1);
    expect(revealed[0]).toBe(lib[lib.length - 1]);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.zones.library['p1']?.[0]).toBe(revealed[0]);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = glided();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
