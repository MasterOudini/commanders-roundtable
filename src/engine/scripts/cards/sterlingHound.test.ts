// `Sterling Hound` — the ETB surveil 2: declining both fills the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STERLING_HOUND_SCRIPT } from './sterlingHound';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hounded(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sterling Hound'], []],
    scripts: createRegistry([STERLING_HOUND_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Sterling Hound');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  if (revealed.length !== 2) throw new Error(`expected 2 revealed, got ${revealed.length}`);
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return g;
}

describe('Sterling Hound', () => {
  test('both surveilled cards fall into the graveyard', () => {
    const g = hounded();
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = hounded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
