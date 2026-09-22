// `Gollum, Patient Plotter` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { GOLLUM_PATIENT_PLOTTER_SCRIPT } from './gollumPatientPlotter';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Gollum, Patient Plotter";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; fodder0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Gollum, Patient Plotter", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([GOLLUM_PATIENT_PLOTTER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const fodder0 = [put(g, 'p1', "Grizzly Bears")];
  settle(g);
  const self = put(g, 'p1', CARD, [1].includes(which) ? 'graveyard' : 'battlefield');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
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
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'exile', player: 'p1' } }));
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0.slice(0, 1) }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, fodder0 };
}

describe("Gollum, Patient Plotter", () => {
  test("When Gollum leaves the battlefield: the vocabulary resolves \"The Ring tempts you.\"", () => {
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

  test("{B}, Sacrifice a creature: it returns from the graveyard to hand", () => {
    const { g, self, hand0, fodder0 } = armed(1);
    expect(g.state.cards[self]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    for (const f of fodder0.slice(0, 1)) expect(g.state.cards[f]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
