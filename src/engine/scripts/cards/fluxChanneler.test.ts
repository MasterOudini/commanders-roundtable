// `Flux Channeler` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { FLUX_CHANNELER_SCRIPT } from './fluxChanneler';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Flux Channeler";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; prolifFodderL0_castNoncreature: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Flux Channeler", "Pyretic Ritual", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([FLUX_CHANNELER_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const prolifFodderL0_castNoncreature = put(g, 'p1', 'Grizzly Bears');
  must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: prolifFodderL0_castNoncreature, kind: '+1/+1', delta: 1 }));
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    const ritual = put(g, 'p1', "Pyretic Ritual", 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, prolifFodderL0_castNoncreature };
}

describe("Flux Channeler", () => {
  test("Whenever you cast a noncreature spell: the vocabulary resolves \"Proliferate.\"", () => {
    const { g, prolifFodderL0_castNoncreature } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'proliferateChoice', 20_000);
    expect(g.state.priority.awaiting?.kind, 'the proliferate ask').toBe('proliferateChoice');
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [prolifFodderL0_castNoncreature], players: [] }));
    settle(g);
    expect(g.state.cards[prolifFodderL0_castNoncreature]?.counters['+1/+1'], 'the fodder took one more counter').toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
