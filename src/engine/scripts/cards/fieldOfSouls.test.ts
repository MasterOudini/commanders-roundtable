// `Field of Souls` — a NONTOKEN creature dying into MY graveyard pays a
// Spirit; a TOKEN dying pays nothing, and an opponent's death pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FIELD_OF_SOULS_SCRIPT } from './fieldOfSouls';
import { SOLDIER_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const FIELD = 'Field of Souls';
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
    decks: [[FIELD, BEARS], [BEARS]],
    scripts: createRegistry([FIELD_OF_SOULS_SCRIPT]),
  });
  put(g, 'p1', FIELD);
  settle(g);
  return g;
}

describe('Field of Souls', () => {
  test('a nontoken creature dying into MY graveyard pays the Spirit', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(spirits(g)).toBe(1);
  });

  test('a TOKEN dying pays nothing — the filter is isToken', () => {
    const g = board();
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }));
    settle(g);
    const token = battlefieldOf(g, 'p1').find((id) => nameOf(g, id) === 'Soldier');
    expect(token).toBeDefined();
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: token as string, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(spirits(g)).toBe(0);
  });

  test("an OPPONENT's creature dies into THEIR graveyard — not mine", () => {
    const g = board();
    const theirs = put(g, 'p2', BEARS);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'graveyard', player: 'p2' } }),
    );
    settle(g);
    expect(spirits(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
