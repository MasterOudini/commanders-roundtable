// `Geist of the Archives` — YOUR upkeep only: the first ask lands on turn
// 3, having passed the opponent's turn-2 upkeep silently.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GEIST_OF_THE_ARCHIVES_SCRIPT } from './geistOfTheArchives';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function haunted(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Geist of the Archives'], ['Grizzly Bears']],
    scripts: createRegistry([GEIST_OF_THE_ARCHIVES_SCRIPT]),
  });
  put(g, 'p1', 'Geist of the Archives');
  settle(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 60_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Geist of the Archives', () => {
  test("the first scry is turn 3's upkeep — the opponent's passed silently", () => {
    const { g, revealed } = haunted();
    expect(g.state.turn.turnNumber).toBe(3);
    expect(g.state.turn.activePlayer).toBe('p1');
    const lib = g.state.zones.library['p1'] ?? [];
    expect(revealed).toHaveLength(1);
    expect(revealed[0]).toBe(lib[lib.length - 1]);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = haunted();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
