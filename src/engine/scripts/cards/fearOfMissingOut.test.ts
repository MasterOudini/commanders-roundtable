// `Fear of Missing Out` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { FEAR_OF_MISSING_OUT_SCRIPT } from './fearOfMissingOut';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Fear of Missing Out";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Fear of Missing Out", "Grizzly Bears", "Forest", "Sol Ring", "Hissing Miasma"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([FEAR_OF_MISSING_OUT_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (which === 1) {
    { advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
      const fired0 = g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length;
      advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.priority.awaiting?.kind === 'declareAttackers', 60000);
      must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
      settle(g);
          if (g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length !== fired0) throw new Error('the trigger fired with its condition unmet');
      advanceUntil(g, (s) => s.turn.turnNumber === 7 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
    }
    put(g, 'p1', "Grizzly Bears", 'graveyard');
    put(g, 'p1', "Forest", 'graveyard');
    put(g, 'p1', "Sol Ring", 'graveyard');
    put(g, 'p1', "Hissing Miasma", 'graveyard');
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
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [no], tapped: true }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 7 && s.priority.awaiting?.kind === 'declareAttackers', 60000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Fear of Missing Out", () => {
  test("When this creature enters: the vocabulary resolves \"Discard a card, then draw a card.\"", () => {
    const { g, hand0 } = armed(0);
    let qdL0 = 0;
    for (let qi = 0; qi < 4; qi++) {
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null), 20_000);
      const qa = g.state.priority.awaiting;
      if (qa?.kind !== 'chooseFromZone' || qa.zone !== 'hand') break;
      must(g.submit({ t: 'AnswerChooseFromZone', player: qa.player, cards: (g.state.zones.hand[qa.player] ?? []).slice(0, qa.count) }));
    }
    settle(g);
    expect(g.state.pendingAsks).toBeNull();
    { const qb = [...g.log].reverse().find((x) => x.body.t === 'CardsMoved' && x.body.moves.some((m) => m.reason === 'discard'));
      expect(qb, 'the queued discard landed').toBeDefined();
      const qm = qb && qb.body.t === 'CardsMoved' ? qb.body.moves : [];
      for (const m of qm) expect(g.state.cards[m.card]?.zone.kind).toBe('graveyard');
      expect(qm.some((m) => m.from.kind === 'hand' && m.from.player === 'p2'), 'p2 was not in the scope').toBe(false);
      qdL0 = qm.filter((m) => m.from.kind === 'hand' && m.from.player === 'p1').length;
    }
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1 - qdL0);
  });

  test("Delirium — Whenever this creature attacks for the first time each turn: the vocabulary resolves \"Untap target creature. After this phase, there is an additional combat phase.\"", () => {
    const { g, no } = armed(1);
    expect(g.state.cards[no]?.tapped).toBe(false);
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
    expect(FEAR_OF_MISSING_OUT_SCRIPT.triggers?.find((t) => t.abilityId.startsWith("attacks-1") && t.oncePerTurn === true), 'the def of line 1 carries oncePerTurn').toBeDefined();
  });
  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
