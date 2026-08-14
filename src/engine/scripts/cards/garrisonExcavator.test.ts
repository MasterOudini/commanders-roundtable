// `Garrison Excavator` — ANY card leaving my graveyard pays the Spirit —
// including a LAND, which is exactly where Desecrated Tomb's type filter
// says no. An opponent's graveyard stays theirs.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GARRISON_EXCAVATOR_SCRIPT } from './garrisonExcavator';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const EXCAVATOR = 'Garrison Excavator';
const MOUNTAIN = 'Mountain';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spirits(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Spirit').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[EXCAVATOR, MOUNTAIN], [BEARS]],
    scripts: createRegistry([GARRISON_EXCAVATOR_SCRIPT]),
  });
  put(g, 'p1', EXCAVATOR);
  settle(g);
  return g;
}

describe('Garrison Excavator', () => {
  test('a LAND leaving my graveyard pays — the mover is untyped', () => {
    const g = board();
    const mountain = put(g, 'p1', MOUNTAIN);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mountain, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(spirits(g)).toBe(0);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mountain, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(spirits(g)).toBe(1);
  });

  test("an OPPONENT's graveyard is not mine", () => {
    const g = board();
    const theirs = put(g, 'p2', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'hand', player: 'p2' } }));
    settle(g);
    expect(spirits(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const mountain = put(g, 'p1', MOUNTAIN);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mountain, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mountain, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
