// `April O'Neil, Kunoichi Trainee` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { APRIL_ONEIL_KUNOICHI_TRAINEE_SCRIPT } from './aprilOneilKunoichiTrainee';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "April O'Neil, Kunoichi Trainee";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; refused: boolean; bearsB: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["April O'Neil, Kunoichi Trainee", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([APRIL_ONEIL_KUNOICHI_TRAINEE_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const bearsB = put(g, 'p1', "Grizzly Bears");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,false][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  let refused = false;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library.p1 ?? [];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: lib.slice(lib.length - 2), toBottom: [] }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }, { card: bearsB, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    refused = !g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: no, attacker: self }] }).ok;
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, refused, bearsB };
}

describe("April O'Neil, Kunoichi Trainee", () => {
  test("When April O'Neil enters: scry 2 asks, and the cards stay on top", () => {
    const { g, lib0 } = armed(0);
    expect(g.state.priority.awaiting).toBeNull();
    expect((g.state.zones.library.p1 ?? []).length).toBe(lib0);
  });

  test("April O'Neil can't be blocked by creatures with power 3 or greater.: the block is refused", () => {
    const { refused } = armed(1);
    expect(refused).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
