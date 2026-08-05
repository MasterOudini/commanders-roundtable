// `Avengers Hangar` — the script owes the gain; D134's built-in owes the
// tap. Both asserted, Asgardian Citadel's proof repeated on its twin.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AVENGERS_HANGAR_SCRIPT } from './avengersHangar';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HANGAR = 'Avengers Hangar';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Avengers Hangar', () => {
  test('entering gains 1 life AND comes in tapped (the built-in rule beside the script)', () => {
    const g = startedGame({
      players: 2,
      decks: [[HANGAR], []],
      scripts: createRegistry([AVENGERS_HANGAR_SCRIPT]),
    });
    const hangar = put(g, 'p1', HANGAR, 'graveyard');
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: hangar,
        to: { kind: 'battlefield', player: 'p1' },
      }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[hangar]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[HANGAR], []],
      scripts: createRegistry([AVENGERS_HANGAR_SCRIPT]),
    });
    put(g, 'p1', HANGAR);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
