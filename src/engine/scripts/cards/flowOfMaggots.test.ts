// `Flow of Maggots` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { FLOW_OF_MAGGOTS_SCRIPT } from './flowOfMaggots';
import { advanceUntil as walkUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';
import type { GameState } from '../../types/state';

const CARD = "Flow of Maggots";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; refused: boolean; bearsB: InstanceId; gift2: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
// D439 - the card's own cumulative upkeep is PAID at every upkeep the walk crosses (the harness's answer declines,
// which sacrifices the card under test); the lands are staged at arming.
function advanceUntil(g: Game, done: (s: GameState) => boolean, maxSteps = 4000): void {
  for (let i = 0; i < 40; i++) {
    walkUntil(g, (s) => done(s) || (s.priority.awaiting?.kind === 'payMana' && / - (?:echo|cumulative upkeep) /.test(s.priority.awaiting.label)), maxSteps);
    const a = g.state.priority.awaiting;
    if (done(g.state) || a?.kind !== 'payMana') return;
    must(g.submit({ t: 'AnswerPayMana', player: a.player, pay: true }));
  }
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Flow of Maggots", "Grizzly Bears", "Forest", "Forest", "Forest"], ["Cyclops of One-Eyed Pass", "Crimson Kobolds"]],
    scripts: createRegistry([FLOW_OF_MAGGOTS_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  put(g, 'p1', "Forest");
  put(g, 'p1', "Forest");
  put(g, 'p1', "Forest");
  const bearsB = put(g, 'p1', "Grizzly Bears");
  const gift2 = put(g, 'p2', "Crimson Kobolds");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  let refused = false;
  if (which === 0) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }, { card: bearsB, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    refused = !g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: gift2, attacker: self }] }).ok;
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, refused, bearsB, gift2 };
}

describe("Flow of Maggots", () => {
  test("This creature can't be blocked by non-Wall creatures.: the block by non-Wall creatures is refused", () => {
    const { refused } = armed(0);
    expect(refused).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
