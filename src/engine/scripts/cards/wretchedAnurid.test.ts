// `Wretched Anurid` - every OTHER creature entering costs its controller 1 life, whoever
// controls the creature; the Anurid itself entering costs nothing; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WRETCHED_ANURID_SCRIPT } from './wretchedAnurid';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Wretched Anurid';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; theirs: InstanceId; mine: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS], [BEARS]], scripts: createRegistry([WRETCHED_ANURID_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  const theirs = put(g, 'p2', BEARS, 'graveyard');
  const mine = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  const life0 = g.state.players.p1?.life ?? 0;
  return { g, self, theirs, mine, life0 };
}

describe('Wretched Anurid', () => {
  test("an opponent's creature entering costs the Anurid's controller 1 life", () => {
    const { g, theirs, life0 } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'battlefield', player: 'p2' } }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 - 1);
  });

  test('its own controller\'s other creature entering costs 1 life too, and two entries cost 2', () => {
    const { g, theirs, mine, life0 } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mine, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'battlefield', player: 'p2' } }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 - 2);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'battlefield', player: 'p2' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
