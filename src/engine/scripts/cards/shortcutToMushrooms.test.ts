// `Shortcut to Mushrooms` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SHORTCUT_TO_MUSHROOMS_SCRIPT } from './shortcutToMushrooms';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Shortcut to Mushrooms";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; vtL1_endStep_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Shortcut to Mushrooms", "Cyclops of One-Eyed Pass", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SHORTCUT_TO_MUSHROOMS_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtL1_endStep_0 = put(g, 'p1', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![true,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  if (which === 1) {
    { advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
      const fired0 = g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length;
      advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'end', 60000);
      settle(g);
          if (g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length !== fired0) throw new Error('the trigger fired with its condition unmet');
      advanceUntil(g, (s) => s.turn.turnNumber === 7 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
    }
    const gone = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: gone, to: { kind: 'exile', player: 'p1' } }));
      settle(g);
  }
  const life0 = g.state.players.p1?.life ?? 0;
  const energy0 = g.state.players.p1?.energy ?? 0;
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
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL1_endStep_0 }] }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, vtL1_endStep_0 };
}

describe("Shortcut to Mushrooms", () => {
  test("When this enchantment enters: the vocabulary resolves \"The Ring tempts you.\"", () => {
    const { g, self } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
    { const ask = g.state.priority.awaiting;
      if (ask?.kind === 'chooseFromZone' && ask.pick === 'ringBearer') {
        const mine = g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === 'p1' && (g.deps.oracle.byPrinting(g.state.cards[id]?.printingId ?? '')?.faces[0]?.typeLine.types.includes('Creature') ?? false));
        must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [(mine.includes(self) ? self : mine[0]) as InstanceId] }));
        settle(g);
      }
      const tempted = g.log.filter((e) => e.body.t === 'RingTempted' && e.body.player === 'p1');
      expect(tempted.length, 'the Ring tempted p1').toBeGreaterThan(0);
      expect(g.state.players.p1?.ringTempts ?? 0, 'the count rose').toBeGreaterThan(0);
      const bearer = g.state.players.p1?.ringBearer ?? null;
      if (bearer !== null) expect(g.state.cards[bearer]?.controller, 'the bearer is a creature p1 controls').toBe('p1');
      expect((g.state.zones.command.p1 ?? []).some((id) => g.state.cards[id]?.oracleId === '98737456-ac2a-420d-aa0e-778ba3a22cec'), 'the Ring in the command zone').toBe(true);
    }
  });

  test("At the beginning of your end step: the vocabulary resolves \"Put a +1/+1 counter on target creature you control.\"", () => {
    const { g, vtL1_endStep_0 } = armed(1);
    expect(g.state.cards[vtL1_endStep_0]?.counters["+1/+1"] ?? 0).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
