// `Golgari Germination` — a nontoken creature I CONTROL dying pays a
// Saproling; an opponent's creature does not, and the Saproling itself —
// a TOKEN — cannot feed the trigger.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOLGARI_GERMINATION_SCRIPT } from './golgariGermination';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GERMINATION = 'Golgari Germination';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function saprolingEvents(g: Game): number {
  return g.log.filter((e) => e.body.t === 'TokenCreated').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[GERMINATION, BEARS], [BEARS]],
    scripts: createRegistry([GOLGARI_GERMINATION_SCRIPT]),
  });
  put(g, 'p1', GERMINATION);
  settle(g);
  return g;
}

describe('Golgari Germination', () => {
  test('my nontoken creature dying pays a Saproling; the dying TOKEN does not', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(saprolingEvents(g)).toBe(1);
    const sap = battlefieldOf(g, 'p1').find((id) => nameOf(g, id) === 'Saproling');
    expect(sap).toBeDefined();
    // Kill the token — `isToken` keeps the trigger silent.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: sap as never, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(saprolingEvents(g)).toBe(1);
  });

  test("an OPPONENT's creature dying pays nothing", () => {
    const g = board();
    const theirs = put(g, 'p2', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(saprolingEvents(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
