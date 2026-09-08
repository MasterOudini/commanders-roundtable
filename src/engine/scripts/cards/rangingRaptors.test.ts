// `Ranging Raptors` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { RANGING_RAPTORS_SCRIPT } from './rangingRaptors';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Ranging Raptors";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; gob: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Ranging Raptors", "Lightning Bolt", "Forest", "Forest"], ["Cyclops of One-Eyed Pass", "Raging Goblin"]],
    scripts: createRegistry([RANGING_RAPTORS_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const gob = put(g, 'p2', 'Raging Goblin');
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: gob, attacker: self }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const ask = g.state.priority.awaiting;
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: ask && ask.kind === 'optionalTrigger' ? ask.stackId : '', accept: true }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: self }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const ask = g.state.priority.awaiting;
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: ask && ask.kind === 'optionalTrigger' ? ask.stackId : '', accept: true }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, gob };
}

describe("Ranging Raptors", () => {
  test("Enrage — Whenever this creature is dealt damage: the vocabulary resolves \"Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\"", () => {
    const { g, board0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    { const stray = Object.keys(g.state.cards).find((id) => nameOf(g, id as InstanceId) === "Forest" && g.state.cards[id as InstanceId]?.zone.kind !== 'library');
      if (stray) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: stray as InstanceId, to: { kind: 'library', player: 'p1' } }));
      const lib = [...(g.state.zones.library.p1 ?? [])];
      const found = lib.find((id) => nameOf(g, id) === "Forest");
      expect(found, "Forest is not in the library for the search to find").toBeDefined();
      must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [found as InstanceId], declined: false }));
      settle(g);
      expect(g.state.cards[found as InstanceId]?.zone).toEqual({ kind: "battlefield", player: 'p1' });
      expect(g.state.cards[found as InstanceId]?.tapped, 'the card the search found arrives tapped').toBe(true);
    }
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test("Enrage — Whenever this creature is dealt damage: the vocabulary resolves \"Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\"", () => {
    const { g, board0 } = armed(1);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    { const stray = Object.keys(g.state.cards).find((id) => nameOf(g, id as InstanceId) === "Forest" && g.state.cards[id as InstanceId]?.zone.kind !== 'library');
      if (stray) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: stray as InstanceId, to: { kind: 'library', player: 'p1' } }));
      const lib = [...(g.state.zones.library.p1 ?? [])];
      const found = lib.find((id) => nameOf(g, id) === "Forest");
      expect(found, "Forest is not in the library for the search to find").toBeDefined();
      must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [found as InstanceId], declined: false }));
      settle(g);
      expect(g.state.cards[found as InstanceId]?.zone).toEqual({ kind: "battlefield", player: 'p1' });
      expect(g.state.cards[found as InstanceId]?.tapped, 'the card the search found arrives tapped').toBe(true);
    }
    expect(onBoard(g)).toBe(board0 + 1 - 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
