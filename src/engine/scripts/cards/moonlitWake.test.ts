// `Moonlit Wake` — ANY creature dying pays 1; a dying artifact pays
// nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOONLIT_WAKE_SCRIPT } from './moonlitWake';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Moonlit Wake', () => {
  test("the OPPONENT's creature dying pays 1; a dying artifact pays nothing", () => {
    const g = startedGame({
      players: 2,
      decks: [['Moonlit Wake', 'Sol Ring'], ['Grizzly Bears']],
      scripts: createRegistry([MOONLIT_WAKE_SCRIPT]),
    });
    put(g, 'p1', 'Moonlit Wake');
    const ring = put(g, 'p1', 'Sol Ring');
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p2',
        card: bears,
        to: { kind: 'graveyard', player: 'p2' },
      }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: ring,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Moonlit Wake'], ['Grizzly Bears']],
      scripts: createRegistry([MOONLIT_WAKE_SCRIPT]),
    });
    put(g, 'p1', 'Moonlit Wake');
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p2',
        card: bears,
        to: { kind: 'graveyard', player: 'p2' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
