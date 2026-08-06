// `Council of Advisors` — the ETB draw, one card type over from Wall of Omens.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COUNCIL_OF_ADVISORS_SCRIPT } from './councilOfAdvisors';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const COUNCIL = 'Council of Advisors';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[COUNCIL], []],
    scripts: createRegistry([COUNCIL_OF_ADVISORS_SCRIPT]),
  });
}

describe('Council of Advisors', () => {
  test('entering draws a card', () => {
    const g = game();
    // ⚠️ Counted in LOG MOVES, not hand size — `put` may fetch the Council
    // from the opening HAND, which makes a hand-size delta read 0 while the
    // draw genuinely happened.
    const logAt = g.log.length;
    put(g, 'p1', COUNCIL);
    settle(g);
    const draws = g.log
      .slice(logAt)
      .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
      .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === 'p1');
    expect(draws).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', COUNCIL);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
