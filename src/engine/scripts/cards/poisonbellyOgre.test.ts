// `Poisonbelly Ogre` - the entering creature's CONTROLLER pays, whoever that is; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { POISONBELLY_OGRE_SCRIPT } from './poisonbellyOgre';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Poisonbelly Ogre';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; theirs: InstanceId; mine: InstanceId; life0: { p1: number; p2: number } } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS], [BEARS]], scripts: createRegistry([POISONBELLY_OGRE_SCRIPT]) });
  holdEverywhere(g);
  put(g, 'p1', CARD);
  const theirs = put(g, 'p2', BEARS, 'graveyard');
  const mine = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  const life0 = { p1: g.state.players.p1?.life ?? 0, p2: g.state.players.p2?.life ?? 0 };
  return { g, theirs, mine, life0 };
}

describe('Poisonbelly Ogre', () => {
  test("an opponent's creature entering costs THAT opponent 1 life", () => {
    const { g, theirs, life0 } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'battlefield', player: 'p2' } }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(life0.p2 - 1);
    expect(g.state.players.p1?.life).toBe(life0.p1);
  });

  test("the Ogre's own controller pays for their own other creature", () => {
    const { g, mine, life0 } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mine, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0.p1 - 1);
    expect(g.state.players.p2?.life).toBe(life0.p2);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'battlefield', player: 'p2' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
