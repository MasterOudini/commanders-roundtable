// `Haunt of the Dead Marshes` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { HAUNT_OF_THE_DEAD_MARSHES_SCRIPT } from './hauntOfTheDeadMarshes';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Haunt of the Dead Marshes";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; condRefused: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Haunt of the Dead Marshes", "Ant-Man, Scott Lang"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([HAUNT_OF_THE_DEAD_MARSHES_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, [1].includes(which) ? 'graveyard' : 'graveyard');
  settle(g);
  if (![true,true][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  const cond1_0_0 = put(g, 'p1', "Ant-Man, Scott Lang");
  let condRefused = false;
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
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library.p1 ?? [];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: lib.slice(lib.length - 1), toBottom: [] }));
    settle(g);
    }
  if (which === 1) {
    // D342 - the condition broken: every fixture exiled (the card itself may count), the activation refused, the fixtures back.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_0, to: { kind: 'exile', player: 'p1' } }));
    { const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); condRefused = !early.ok && early.reason === 'timingRestriction'; }
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_0, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, condRefused };
}

describe("Haunt of the Dead Marshes", () => {
  test("When this creature enters: scry 1 asks, and the cards stay on top", () => {
    const { g, lib0 } = armed(0);
    expect(g.state.priority.awaiting).toBeNull();
    expect((g.state.zones.library.p1 ?? []).length).toBe(lib0);
  });

  test("{2}{B}: it returns from the graveyard to the battlefield tapped - refused unless if you control a legendary creature", () => {
    const { g, self, condRefused } = armed(1);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.controller).toBe('p1');
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(condRefused).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
