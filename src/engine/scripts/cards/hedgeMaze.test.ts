// `Hedge Maze` — the surveil land's Forest-Island twin: enters tapped
// (the built-in), then the surveil ask; the graveyard answer works.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HEDGE_MAZE_SCRIPT } from './hedgeMaze';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mazed(): { g: Game; maze: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Hedge Maze'], ['Grizzly Bears']],
    scripts: createRegistry([HEDGE_MAZE_SCRIPT]),
  });
  settle(g);
  const maze = put(g, 'p1', 'Hedge Maze');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, maze, revealed };
}

describe('Hedge Maze', () => {
  test('enters TAPPED, asks a surveil 1, and the graveyard answer buries the card', () => {
    const { g, maze, revealed } = mazed();
    expect(g.state.cards[maze]?.tapped).toBe(true);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.cards[revealed[0] as InstanceId]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = mazed();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
