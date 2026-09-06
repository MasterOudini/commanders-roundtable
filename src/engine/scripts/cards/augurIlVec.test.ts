// `Augur il-Vec` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { AUGUR_IL_VEC_SCRIPT } from './augurIlVec';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Augur il-Vec";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; condRefused: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Augur il-Vec"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([AUGUR_IL_VEC_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  let condRefused = false;
  if (which === 0) {
    // D342 - the opponent's second turn: not your turn, not your upkeep - refused for the condition alone.
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'upkeep' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    { const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); condRefused = !early.ok && early.reason === 'timingRestriction'; }
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && ([0].includes(which) ? s.turn.step === 'upkeep' : s.turn.phase === 'precombatMain') && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, condRefused };
}

describe("Augur il-Vec", () => {
  test("Sacrifice this creature: 4 life is gained - refused unless during your upkeep", () => {
    const { g, self, life0, condRefused } = armed(0);
    expect(g.state.players.p1?.life).toBe(life0 + 4);
    expect(condRefused).toBe(true);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
