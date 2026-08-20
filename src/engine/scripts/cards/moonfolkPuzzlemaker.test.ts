// `Moonfolk Puzzlemaker` — any tap raises the scry 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOONFOLK_PUZZLEMAKER_SCRIPT } from './moonfolkPuzzlemaker';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function puzzled(): { g: Game; folk: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Moonfolk Puzzlemaker'], []],
    scripts: createRegistry([MOONFOLK_PUZZLEMAKER_SCRIPT]),
  });
  const folk = put(g, 'p1', 'Moonfolk Puzzlemaker');
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [folk], tapped: true }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, folk, revealed };
}

describe('Moonfolk Puzzlemaker', () => {
  test('becoming tapped asks a scry 1 that BOTTOMS, never buries', () => {
    const { g, revealed } = puzzled();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(false);
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    // Bottom of the library is index 0.
    expect((g.state.zones.library['p1'] ?? [])[0]).toBe(revealed[0]);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = puzzled();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
