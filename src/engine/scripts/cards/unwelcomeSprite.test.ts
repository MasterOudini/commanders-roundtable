// `Unwelcome Sprite` — the turn condition is the card: a spell cast on an
// OPPONENT'S turn surveils, the same spell on MY turn does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UNWELCOME_SPRITE_SCRIPT } from './unwelcomeSprite';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPRITE = 'Unwelcome Sprite';
const INSTANT = 'Dark Ritual'; // instant speed, so it can be cast on any turn

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Casts an instant on `whose` turn and reports whether the surveil was asked. */
function cast(whose: 'p1' | 'p2'): boolean {
  const g = startedGame({
    players: 2,
    decks: [[SPRITE, INSTANT], []],
    scripts: createRegistry([UNWELCOME_SPRITE_SCRIPT]),
  });
  put(g, 'p1', SPRITE);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 2 &&
      s.turn.activePlayer === whose &&
      s.priority.player === 'p1' &&
      s.priority.awaiting === null,
    120_000,
  );
  const spell = put(g, 'p1', INSTANT, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(
    g,
    (s) => s.priority.awaiting?.kind === 'scryChoice' || s.stack.length === 0,
    20_000,
  );
  return g.state.priority.awaiting?.kind === 'scryChoice';
}

describe('Unwelcome Sprite', () => {
  test("casting on an OPPONENT'S turn asks the surveil", () => {
    expect(cast('p2')).toBe(true);
  });

  test('casting on MY OWN turn asks nothing', () => {
    expect(cast('p1')).toBe(false);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SPRITE], []],
      scripts: createRegistry([UNWELCOME_SPRITE_SCRIPT]),
    });
    put(g, 'p1', SPRITE);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
