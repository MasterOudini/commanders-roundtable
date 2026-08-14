// `Jhoira, Weatherlight Captain` — a HISTORIC cast (an artifact) draws; a
// plain creature cast pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JHOIRA_WEATHERLIGHT_CAPTAIN_SCRIPT } from './jhoiraWeatherlightCaptain';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const JHOIRA = 'Jhoira, Weatherlight Captain';
const STRIX = 'Baleful Strix';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[JHOIRA, STRIX, BEARS], []],
    scripts: createRegistry([JHOIRA_WEATHERLIGHT_CAPTAIN_SCRIPT]),
  });
  put(g, 'p1', JHOIRA);
  settle(g);
  return g;
}

describe('Jhoira, Weatherlight Captain', () => {
  test('casting an artifact draws a card — net unchanged', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    const strix = put(g, 'p1', STRIX, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: strix }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before);
  });

  test('a plain creature cast pays nothing — the historic filter holds', () => {
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
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    const strix = put(g, 'p1', STRIX, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: strix }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
