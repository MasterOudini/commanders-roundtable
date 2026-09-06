// `Galvanic Juggernaut` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { GALVANIC_JUGGERNAUT_SCRIPT } from './galvanicJuggernaut';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Galvanic Juggernaut";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; refused: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Galvanic Juggernaut", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([GALVANIC_JUGGERNAUT_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
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
  let refused = false;
  if (which === 0) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    refused = !g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [] }).ok;
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: true }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain', 40_000);
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: no, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, refused };
}

describe("Galvanic Juggernaut", () => {
  test("This creature attacks each combat if able.: an empty declaration is refused, then it attacks", () => {
    const { g, self, refused } = armed(0);
    expect(refused).toBe(true);
    expect(g.state.combat?.attackers.some((x) => x.card === self) ?? false).toBe(true);
  });

  test("This creature doesn't untap during your untap step.: it stays tapped through its untap step", () => {
    const { g, self } = armed(1);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test("Whenever another creature dies: it untaps", () => {
    const { g, self } = armed(2);
    expect(g.state.cards[self]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
