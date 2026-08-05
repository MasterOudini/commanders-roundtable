// `Wall of Omens` — the first shipped DRAW, which is why this file carries the
// empty-library case: the script must route through THE one draw rule
// (`drawEvents`), and the proof is that a Wall entering on an empty library
// sets up the same loss the draw step would (CR 704.5b).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WALL_OF_OMENS_SCRIPT } from './wallOfOmens';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WALL = 'Wall of Omens';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Wall of Omens', () => {
  test('its entry draws its controller one card, asserted on the MOVE', () => {
    const g = startedGame({
      players: 2,
      decks: [[WALL], []],
      scripts: createRegistry([WALL_OF_OMENS_SCRIPT]),
    });
    // ⚠️ Staged through the GRAVEYARD, and the hand measured BEFORE the entry.
    // The first cut put the Wall straight onto the battlefield and measured
    // after — but `put` takes the card from the HAND when the shuffle dealt it
    // there, and the trigger can resolve inside `put`'s own pump, so the −1
    // and the +1 cancelled and the assertion raced its own measurement.
    const id = put(g, 'p1', WALL, 'graveyard');
    settle(g);
    const handBefore = idsIn(g, 'p1', 'hand').length;
    const logBefore = g.log.length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }),
    );
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
    // The draw is a library→hand move for the CONTROLLER, after the trigger
    // resolved — not a rules-of-turn draw that happened to coincide.
    const drew = g.log
      .slice(logBefore)
      .some(
        (e) =>
          e.body.t === 'CardsMoved' &&
          e.body.moves.some(
            (m) =>
              m.from.kind === 'library' &&
              m.from.player === 'p1' &&
              m.to.kind === 'hand' &&
              m.to.player === 'p1',
          ),
      );
    expect(drew).toBe(true);
  });

  test('entering on an EMPTY library sets up the same loss the draw step would', () => {
    // librarySize 7: the opening hand takes all seven, so the Wall is in HAND
    // over an empty library — `put` finds it there.
    const g = startedGame({
      players: 2,
      decks: [[WALL], []],
      librarySize: 7,
      scripts: createRegistry([WALL_OF_OMENS_SCRIPT]),
    });
    expect(idsIn(g, 'p1', 'library').length).toBe(0);
    put(g, 'p1', WALL);
    settle(g);
    expect(g.log.some((e) => e.body.t === 'DrewFromEmptyLibrary' && e.body.player === 'p1')).toBe(true);
    expect(g.log.some((e) => e.body.t === 'PlayerLost' && e.body.player === 'p1')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[WALL], []],
      scripts: createRegistry([WALL_OF_OMENS_SCRIPT]),
    });
    put(g, 'p1', WALL);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
