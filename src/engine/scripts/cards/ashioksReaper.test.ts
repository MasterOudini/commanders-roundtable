// `Ashiok's Reaper` — the filter is three questions (enchantment, yours, from
// the battlefield to a graveyard) and each negative is its own test.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ASHIOKS_REAPER_SCRIPT } from './ashioksReaper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const REAPER = "Ashiok's Reaper";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [
      [REAPER, "Ajani's Mantra", 'Grizzly Bears'],
      ["Ajani's Mantra"],
    ],
    scripts: createRegistry([ASHIOKS_REAPER_SCRIPT]),
  });
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
        ),
    ).length;
}

function toGraveyard(g: Game, player: string, card: InstanceId): void {
  must(g.submit({ t: 'ManualMoveCard', player, card, to: { kind: 'graveyard', player } }));
  settle(g);
}

describe("Ashiok's Reaper", () => {
  test('an enchantment YOU control dying draws a card', () => {
    const g = game();
    put(g, 'p1', REAPER);
    const mantra = put(g, 'p1', "Ajani's Mantra");
    settle(g);
    const logAt = g.log.length;
    toGraveyard(g, 'p1', mantra);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test("an OPPONENT'S enchantment dying draws nothing", () => {
    const g = game();
    put(g, 'p1', REAPER);
    const theirs = put(g, 'p2', "Ajani's Mantra");
    settle(g);
    const logAt = g.log.length;
    toGraveyard(g, 'p2', theirs);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('a CREATURE dying draws nothing — the type is asked of derive', () => {
    const g = game();
    put(g, 'p1', REAPER);
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const logAt = g.log.length;
    toGraveyard(g, 'p1', bears);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', REAPER);
    const mantra = put(g, 'p1', "Ajani's Mantra");
    settle(g);
    toGraveyard(g, 'p1', mantra);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
