// `Desecrated Tomb` — a creature card LEAVING my graveyard pays a Bat;
// entering pays nothing, a land pays nothing, an opponent's graveyard pays
// nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DESECRATED_TOMB_SCRIPT } from './desecratedTomb';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TOMB = 'Desecrated Tomb';
const BEARS = 'Grizzly Bears';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bats(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Bat').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[TOMB, BEARS, MOUNTAIN], [BEARS]],
    scripts: createRegistry([DESECRATED_TOMB_SCRIPT]),
  });
  put(g, 'p1', TOMB);
  settle(g);
  return g;
}

describe('Desecrated Tomb', () => {
  test('a creature card leaving my graveyard creates a Bat; ENTERING it did not', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(bats(g)).toBe(0);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(bats(g)).toBe(1);
  });

  test('a LAND leaving pays nothing — the mover must be a creature card', () => {
    const g = board();
    const mountain = put(g, 'p1', MOUNTAIN);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mountain, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mountain, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(bats(g)).toBe(0);
  });

  test("an OPPONENT's graveyard is not mine", () => {
    const g = board();
    const theirs = put(g, 'p2', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'hand', player: 'p2' } }));
    settle(g);
    expect(bats(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
