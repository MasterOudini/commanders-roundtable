// `Captive Weird // Compleated Conjurer` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { CAPTIVE_WEIRD_COMPLEATED_CONJURER_SCRIPT } from './captiveWeirdCompleatedConjurer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Captive Weird // Compleated Conjurer";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

// D578 - the card turned to the face the fired ability belongs to (the manual flip).
function faceUp(g: Game, self: InstanceId, face: number): void {
  const c = g.state.cards[self];
  if (!c || c.zone.kind !== 'battlefield' || (c.faceIndex ?? 0) === face) return;
  must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Captive Weird // Compleated Conjurer"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([CAPTIVE_WEIRD_COMPLEATED_CONJURER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  faceUp(g, self, [0,0][which] ?? 0);
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
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Captive Weird // Compleated Conjurer", () => {
  test("{3}{R/P}: the vocabulary resolves \"Transform this creature.\"", () => {
    const { g, self } = armed(0);
    expect(g.state.cards[self]?.faceIndex ?? 0, 'transformed').toBe(1);
  });

  test("When this creature transforms into Compleated Conjurer: the vocabulary resolves \"Exile the top card of your library. Until the end of your next turn, you may play that card.\"", () => {
    const { g } = armed(1);
    { const granted = g.log.filter((ev) => ev.body.t === 'PlayPermissionGranted');
      expect(granted.length, 'a permission per exiled card').toBeGreaterThanOrEqual(1);
      for (const ev of granted) if (ev.body.t === 'PlayPermissionGranted') expect(g.state.cards[ev.body.permission.card]?.zone.kind, 'the card is in exile').toBe('exile'); }
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
