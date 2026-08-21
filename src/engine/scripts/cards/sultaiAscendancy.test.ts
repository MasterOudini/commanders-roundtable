// `Sultai Ascendancy` — MY upkeep raises the surveil 2; the opponent's
// passes silently.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SULTAI_ASCENDANCY_SCRIPT } from './sultaiAscendancy';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ascended(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sultai Ascendancy'], []],
    scripts: createRegistry([SULTAI_ASCENDANCY_SCRIPT]),
  });
  put(g, 'p1', 'Sultai Ascendancy');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 60_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  if (revealed.length !== 2) throw new Error(`expected 2 revealed, got ${revealed.length}`);
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return g;
}

describe('Sultai Ascendancy', () => {
  test('the upkeep surveil bins both cards', () => {
    const g = ascended();
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = ascended();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
