// `Soul Enervation` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SOUL_ENERVATION_SCRIPT } from './soulEnervation';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Soul Enervation";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Soul Enervation", "Crimson Kobolds"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SOUL_ENERVATION_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const gyFix0 = put(g, 'p1', "Crimson Kobolds", 'graveyard');
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
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: gyFix0, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0 };
}

describe("Soul Enervation", () => {
  test("When this enchantment enters: the vocabulary resolves \"Target creature gets -4/-4 until end of turn.\"", () => {
    const { g, no } = armed(0);
    expect(g.state.cards[no]?.zone.kind).toBe('graveyard');
  });

  test("Whenever one or more creature cards leave your graveyard: each opponent loses 1 life and 1 is gained", () => {
    const { g, life0, p2life0 } = armed(1);
    expect(g.state.players.p2?.life).toBe(p2life0 - 1);
    expect(g.state.players.p1?.life).toBe(life0 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
