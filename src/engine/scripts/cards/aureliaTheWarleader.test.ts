// `Aurelia, the Warleader` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { AURELIA_THE_WARLEADER_SCRIPT } from './aureliaTheWarleader';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Aurelia, the Warleader";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; ownBear: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Aurelia, the Warleader", "Runeclaw Bear"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([AURELIA_THE_WARLEADER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const ownBear = put(g, 'p1', "Runeclaw Bear");
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
  if (which === 0) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ownBear], tapped: true }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, ownBear };
}

describe("Aurelia, the Warleader", () => {
  test("Whenever Aurelia attacks for the first time each turn: the vocabulary resolves \"Untap all creatures you control. After this phase, there is an additional combat phase.\"", () => {
    const { g, ownBear } = armed(0);
    expect(g.state.cards[ownBear]?.tapped, 'the witness on your side untapped').toBe(false);
    expect(g.log.some((e) => e.body.t === 'ExtraPhasesAdded' && JSON.stringify(e.body.phases) === "[\"combat\"]"), "the additional phases queued: [\"combat\"]").toBe(true);
    /*EXTRA_COMBAT_WALK*/
    {
      const tn = g.state.turn.turnNumber;
      advanceUntil(g, (s) => s.turn.turnNumber === tn + 1 && s.turn.step === 'upkeep', 40_000);
      let tAt = 0;
      let combats = 0;
      for (const e of g.log) {
        if (e.body.t === 'TurnBegan') tAt = e.body.turnNumber;
        if (e.body.t === 'StepBegan' && e.body.step === 'beginCombat' && tAt === tn) combats += 1;
      }
      expect(combats, 'the additional combat phase was taken in the fire turn (CR 500.8)').toBeGreaterThanOrEqual(2);
      expect(g.state.turn.extraPhases, 'nothing pending into the next turn').toEqual([]);
      expect(g.state.turn.resumeStep, 'the insertion is over').toBeNull();
    }
  });

  test('the once-per-turn rider rides the def (D492)', () => {
    expect(AURELIA_THE_WARLEADER_SCRIPT.triggers?.find((t) => t.abilityId.startsWith("attacks-1") && t.oncePerTurn === true), 'the def of line 1 carries oncePerTurn').toBeDefined();
  });
  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
