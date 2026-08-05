// `Asgardian Citadel` — the script owes the gain; D134's built-in owes the
// tap. Both are asserted, because a card is complete only if all of it runs.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ASGARDIAN_CITADEL_SCRIPT } from './asgardianCitadel';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CITADEL = 'Asgardian Citadel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Asgardian Citadel', () => {
  test('entering gains 1 life AND comes in tapped (the built-in rule beside the script)', () => {
    const g = startedGame({
      players: 2,
      decks: [[CITADEL], []],
      scripts: createRegistry([ASGARDIAN_CITADEL_SCRIPT]),
    });
    const citadel = put(g, 'p1', CITADEL, 'graveyard');
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: citadel,
        to: { kind: 'battlefield', player: 'p1' },
      }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[citadel]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CITADEL], []],
      scripts: createRegistry([ASGARDIAN_CITADEL_SCRIPT]),
    });
    put(g, 'p1', CITADEL);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
