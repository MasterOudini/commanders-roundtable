// `Dross Harvester` - two creatures dying gain 4 (one trigger each); its controller's
// end step costs 4; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DROSS_HARVESTER_SCRIPT } from './drossHarvester';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Dross Harvester';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; a: InstanceId; b: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD], [BEARS, BEARS]], scripts: createRegistry([DROSS_HARVESTER_SCRIPT]) });
  holdEverywhere(g);
  put(g, 'p1', CARD);
  const a = put(g, 'p2', BEARS);
  const b = put(g, 'p2', BEARS);
  settle(g);
  const life0 = g.state.players.p1?.life ?? 0;
  return { g, a, b, life0 };
}

describe('Dross Harvester', () => {
  test('each creature dying gains its controller 2 life', () => {
    const { g, a, b, life0 } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: a, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: b, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 + 4);
  });

  test("its controller's end step costs 4 life", () => {
    const { g, life0 } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.step === 'end', 20_000);
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 - 4);
  });

  test('replays to the same hash', () => {
    const { g, a } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: a, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
