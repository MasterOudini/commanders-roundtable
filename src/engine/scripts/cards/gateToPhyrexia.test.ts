// `Gate to Phyrexia` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { GATE_TO_PHYREXIA_SCRIPT } from './gateToPhyrexia';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Gate to Phyrexia";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; refused: boolean; condRefused: boolean; vtA0_0: InstanceId; fodder0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Gate to Phyrexia", "Grizzly Bears"], ["Cyclops of One-Eyed Pass", "Sol Ring"]],
    scripts: createRegistry([GATE_TO_PHYREXIA_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtA0_0 = put(g, 'p2', "Sol Ring");
  const fodder0 = put(g, 'p1', "Grizzly Bears");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  let condRefused = false;
  if (which === 0) {
    // D344 - the opponent's second turn: not your turn, not your upkeep - refused for the condition alone.
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'upkeep' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    { const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0 }); condRefused = !early.ok && early.reason === 'timingRestriction'; }
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && ([0].includes(which) ? s.turn.step === 'upkeep' : s.turn.phase === 'precombatMain') && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  let refused = false;
  if (which === 0) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA0_0 }] }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, refused, condRefused, vtA0_0, fodder0 };
}

describe("Gate to Phyrexia", () => {
  test("Sacrifice a creature: the vocabulary resolves \"Destroy target artifact.\" - refused unless during your upkeep", () => {
    const { g, refused, condRefused, vtA0_0, fodder0 } = armed(0);
    expect(g.state.cards[vtA0_0]?.zone.kind).toBe('graveyard');
    expect(refused).toBe(true);
    expect(condRefused).toBe(true);
    expect(g.state.cards[fodder0]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
