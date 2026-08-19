// `DrewCards` (D189) — the REAL-draw marker: emitted beside the draw step's
// and `drawEvents`' moves, in draw order, and NOWHERE else. The negatives are
// the feature: opening hands and Impulse-style takes stay silent, which is
// what makes "whenever you draw" watchable at all (D179's discriminator).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import { WALL_OF_BLOSSOMS_SCRIPT } from './scripts/cards/wallOfBlossoms';
import { advanceUntil, put, startedGame } from './testing/harness';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function markers(g: Game, from = 0) {
  return g.log
    .slice(from)
    .map((e) => e.body)
    .filter((b) => b.t === 'DrewCards');
}

describe('DrewCards', () => {
  test('the opening hands are NOT draws; the draw step is', () => {
    const g = startedGame({ players: 2, decks: [[], []] });
    const firstTurn = g.log.findIndex((e) => e.body.t === 'TurnBegan');
    expect(firstTurn).toBeGreaterThan(-1);
    // 7-card opening hands were dealt before the first turn — zero markers.
    expect(markers(g).length === 0 || g.log.findIndex((e) => e.body.t === 'DrewCards') > firstTurn).toBe(true);
    const before = markers(g).length;
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    const after = markers(g);
    expect(after.length).toBeGreaterThan(before);
    // Every marker names at least one card, and each id it names was moved
    // library → hand by the SAME log (the marker derives from the moves).
    const movedToHand = new Set(
      g.log.flatMap((e) =>
        e.body.t === 'CardsMoved'
          ? e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').map((m) => m.card)
          : [],
      ),
    );
    for (const m of after) {
      if (m.t !== 'DrewCards') continue;
      expect(m.cards.length).toBeGreaterThan(0);
      for (const id of m.cards) expect(movedToHand.has(id)).toBe(true);
    }
  });

  test('a scripted draw marks exactly its own card', () => {
    const g = startedGame({
      players: 2,
      decks: [['Wall of Blossoms', 'Forest', 'Forest'], []],
      scripts: createRegistry([WALL_OF_BLOSSOMS_SCRIPT]),
    });
    settle(g);
    const logAt = g.log.length;
    put(g, 'p1', 'Wall of Blossoms');
    settle(g);
    const ms = markers(g, logAt);
    expect(ms).toHaveLength(1);
    const m = ms[0];
    if (m?.t !== 'DrewCards') throw new Error('unreachable');
    expect(m.player).toBe('p1');
    expect(m.cards).toHaveLength(1);
  });

  test('a manual library-to-hand move is NOT a draw', () => {
    const g = startedGame({ players: 2, decks: [['Forest'], []] });
    settle(g);
    const logAt = g.log.length;
    // The Tier-3 tool moves a card from library to hand — a "take", never a
    // draw. `put` fetches from anywhere via the manual mover, so this is the
    // discriminator's negative in one line.
    put(g, 'p1', 'Forest', 'hand');
    expect(markers(g, logAt)).toHaveLength(0);
  });

  test('replays to the same hash with markers in the log', () => {
    const g = startedGame({ players: 2, decks: [[], []] });
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(markers(g).length).toBeGreaterThan(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
