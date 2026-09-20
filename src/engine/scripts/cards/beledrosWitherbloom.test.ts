// `Beledros Witherbloom` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { BELEDROS_WITHERBLOOM_SCRIPT } from './beledrosWitherbloom';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Beledros Witherbloom";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; refused: boolean; ownLand: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Beledros Witherbloom", "Grizzly Bears", "Wastes"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([BELEDROS_WITHERBLOOM_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const ownLand = put(g, 'p1', "Wastes");
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
  let refused = false;
  if (which === 0) {
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'upkeep', 40_000);
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ownLand], tapped: true }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, refused, ownLand };
}

describe("Beledros Witherbloom", () => {
  test("At the beginning of each upkeep: the vocabulary resolves \"Create a 1/1 black and green Pest creature token with \\\"When this token dies, you gain 1 life.\\\"\"", () => {
    const { g, board0 } = armed(0);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test("Pay 10 life: the vocabulary resolves \"Untap all lands you control.\"", () => {
    const { g, life0, refused, ownLand } = armed(1);
    expect(g.state.cards[ownLand]?.tapped, 'the witness on your side untapped').toBe(false);
    expect(refused).toBe(true);
    expect(g.state.players.p1?.life).toBe(life0 - 10);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
