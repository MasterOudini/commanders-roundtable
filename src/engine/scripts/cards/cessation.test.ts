// `Cessation` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CESSATION_SCRIPT } from './cessation';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Cessation";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; refused: boolean; bearsB: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Cessation", "Grizzly Bears", "Coral Eel"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([CESSATION_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const bearsB = put(g, 'p1', "Grizzly Bears");
  put(g, 'p1', "Coral Eel");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  if (![true,true][which]) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  let refused = false;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    refused = !g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bearsB, defender: { kind: 'player', id: 'p2' } }] }).ok;
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, refused, bearsB };
}

describe("Cessation", () => {
  test("Enchanted creature can't attack.: the creature it is attached to is held back", () => {
    const { g, self, refused, bearsB } = armed(0);
    expect(g.state.cards[self]?.attachedTo).toBe(bearsB);
    expect(refused).toBe(true);
  });

  test("When this Aura is put into a graveyard from the battlefield: it returns to its owner's hand", () => {
    const { g, self } = armed(1);
    expect(g.state.cards[self]?.zone.kind).toBe('hand');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
