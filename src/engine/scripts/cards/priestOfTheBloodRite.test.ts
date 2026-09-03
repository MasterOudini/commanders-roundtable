// `Priest of the Blood Rite` - entering makes a 5/5 flying Demon token; the next upkeep
// costs 2 life; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRIEST_OF_THE_BLOOD_RITE_SCRIPT } from './priestOfTheBloodRite';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Priest of the Blood Rite';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; self: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD], ['Grizzly Bears']], scripts: createRegistry([PRIEST_OF_THE_BLOOD_RITE_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  return { g, self, life0 };
}

describe('Priest of the Blood Rite', () => {
  test('entering creates a 5/5 flying Demon token under its controller', () => {
    const { g, self } = entered();
    const tokens = Object.values(g.state.cards).filter((c) => c.isToken && c.zone.kind === 'battlefield' && c.controller === 'p1');
    expect(tokens).toHaveLength(1);
    // The token's IDENTITY is asserted; its 5/5 and flying are the TOKEN_TABLE row's,
    // pinned by tokenTable.node.test.ts (the test oracle holds no printing for it).
    expect(tokens[0]?.oracleId).toBe(TOKEN_TABLE['Demon|5/5|B|Creature|flying']?.oracleId);
    expect(tokens[0]?.controller).toBe('p1');
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
  });

  test("its controller's next upkeep costs 2 life", () => {
    const { g, life0 } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'upkeep', 20_000);
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 - 2);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
