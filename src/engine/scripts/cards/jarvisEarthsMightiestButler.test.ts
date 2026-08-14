// `Jarvis, Earth's Mightiest Butler` — a HERO cast draws; a non-Hero cast
// pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JARVIS_EARTHS_MIGHTIEST_BUTLER_SCRIPT } from './jarvisEarthsMightiestButler';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const JARVIS = "Jarvis, Earth's Mightiest Butler";
const SPIDER_HAM = 'Spider-Ham, Peter Porker';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[JARVIS, SPIDER_HAM, BEARS], []],
    scripts: createRegistry([JARVIS_EARTHS_MIGHTIEST_BUTLER_SCRIPT]),
  });
  put(g, 'p1', JARVIS);
  settle(g);
  return g;
}

describe("Jarvis, Earth's Mightiest Butler", () => {
  test('casting a Hero draws a card — net unchanged after the cast leaves hand', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const ham = put(g, 'p1', SPIDER_HAM, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ham }));
    settle(g);
    // −1 for the cast Hero, +1 for the draw: net unchanged.
    expect(idsIn(g, 'p1', 'hand').length).toBe(before);
  });

  test('a non-Hero cast pays nothing — the subtype filter holds', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const bears = put(g, 'p1', BEARS, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before - 1);
  });

  test('replays to the same hash', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const ham = put(g, 'p1', SPIDER_HAM, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ham }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
