// `Ulvenwald Observer` — the toughness ladder: 6 pays, 4 pays, 2 does not,
// and an OPPONENT's big creature pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ULVENWALD_OBSERVER_SCRIPT } from './ulvenwaldObserver';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OBSERVER = 'Ulvenwald Observer';
const SIX = 'Grave Titan'; // 6/6
const FOUR = 'Air Elemental'; // 4/4
const TWO = 'Grizzly Bears'; // 2/2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

/** Kills a `name` under `seat` with a Tier-3 move and reports p1's draws. */
function killed(seat: 'p1' | 'p2', name: string): number {
  const g = startedGame({
    players: 2,
    decks: [[OBSERVER, SIX, FOUR, TWO], [SIX, FOUR, TWO]],
    scripts: createRegistry([ULVENWALD_OBSERVER_SCRIPT]),
  });
  put(g, 'p1', OBSERVER);
  const victim: InstanceId = put(g, seat, name);
  settle(g);
  const since = g.log.length;
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: seat,
      card: victim,
      to: { kind: 'graveyard', player: seat },
    }),
  );
  settle(g);
  return drawn(g, since);
}

describe('Ulvenwald Observer', () => {
  test('toughness 6 pays, toughness 4 pays, toughness 2 does not', () => {
    expect(killed('p1', SIX)).toBe(1);
    expect(killed('p1', FOUR)).toBe(1);
    expect(killed('p1', TWO)).toBe(0);
  });

  test("an OPPONENT's big creature pays nothing — the clause says you control", () => {
    expect(killed('p2', SIX)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[OBSERVER, SIX], []],
      scripts: createRegistry([ULVENWALD_OBSERVER_SCRIPT]),
    });
    put(g, 'p1', OBSERVER);
    const titan = put(g, 'p1', SIX);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: titan,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
