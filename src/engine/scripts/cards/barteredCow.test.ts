// `Bartered Cow` — one line, two zone-changes, and the discard half is the
// FIRST trigger watching from the HAND: both paths make a Food, separately.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BARTERED_COW_SCRIPT } from './barteredCow';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const COW = 'Bartered Cow';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[COW], []],
    scripts: createRegistry([BARTERED_COW_SCRIPT]),
  });
}

function foods(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food').length;
}

describe('Bartered Cow', () => {
  test('DYING makes a Food', () => {
    const g = game();
    const cow = put(g, 'p1', COW);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: cow, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(foods(g)).toBe(1);
  });

  test('being DISCARDED from hand makes a Food — the def watches the hand', () => {
    const g = game();
    const cow = put(g, 'p1', COW, 'hand');
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: cow, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(foods(g)).toBe(1);
    expect(
      g.log.slice(logAt).some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual'),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = game();
    const cow = put(g, 'p1', COW, 'hand');
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: cow, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
