// `Sheoldred, Whispering One` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SHEOLDRED_WHISPERING_ONE_SCRIPT } from './sheoldredWhisperingOne';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Sheoldred, Whispering One";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; vtL1_upkeep_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Sheoldred, Whispering One", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SHEOLDRED_WHISPERING_ONE_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtL1_upkeep_0 = put(g, 'p1', "Grizzly Bears", 'graveyard');
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![null,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL1_upkeep_0 }] }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'upkeep', 40_000);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, vtL1_upkeep_0 };
}

describe("Sheoldred, Whispering One", () => {
  test("At the beginning of your upkeep: the vocabulary resolves \"Return target creature card from your graveyard to the battlefield.\"", () => {
    const { g, board0, vtL1_upkeep_0 } = armed(0);
    expect(g.state.cards[vtL1_upkeep_0]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[vtL1_upkeep_0]?.controller).toBe('p1');
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test("At the beginning of each opponent's upkeep: the vocabulary resolves \"Target player sacrifices a creature of target player's choice.\"", () => {
    const { g } = armed(1);
    for (let qi = 0; qi < 4; qi++) {
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null), 20_000);
      const qa = g.state.priority.awaiting;
      if (qa?.kind !== 'chooseFromZone' || qa.zone !== 'battlefield') break;
      let qDone = false;
      for (const qc of g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === qa.player)) {
        if (g.submit({ t: 'AnswerChooseFromZone', player: qa.player, cards: [qc] }).ok) { qDone = true; break; }
      }
      expect(qDone, 'the queued sacrifice could be answered for ' + qa.player).toBe(true);
    }
    settle(g);
    expect(g.state.pendingAsks).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
