// `Web of Life and Destiny` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { WEB_OF_LIFE_AND_DESTINY_SCRIPT } from './webOfLifeAndDestiny';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Web of Life and Destiny";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Web of Life and Destiny", "Grizzly Bears", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([WEB_OF_LIFE_AND_DESTINY_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![null][which]) {
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
  if (which === 0) {
    const lookPicksL1_combatOnYourTurn = (Object.keys(g.state.cards) as InstanceId[]).filter((id) => nameOf(g, id) === "Grizzly Bears" && (g.state.cards[id]?.zone.kind === 'library' || g.state.cards[id]?.zone.kind === 'hand'));
    expect(lookPicksL1_combatOnYourTurn.length, "Grizzly Bears is dealt for the look").toBeGreaterThan(0);
    for (const id of lookPicksL1_combatOnYourTurn) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'beginCombat', 20000);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Web of Life and Destiny", () => {
  test("At the beginning of combat on your turn: the vocabulary resolves \"Look at the top five cards of your library. You may put a creature card from among them onto the battlefield. Put the rest on the bottom of your library in a random order.\"", () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    { const shown = (g.state.zones.library.p1 ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
      const found = shown.find((id) => nameOf(g, id) === "Grizzly Bears");
      expect(found, "Grizzly Bears is not among the revealed cards").toBeDefined();
      const picks = [found as InstanceId];
      const rest = shown.filter((id) => !picks.includes(id));
      const handBefore = (g.state.zones.hand.p1 ?? []).length;
      must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: picks }));
      settle(g);
      for (const id of picks) expect(g.state.cards[id]?.zone).toEqual({ kind: "battlefield", player: 'p1' });
      for (const id of rest) expect(g.state.cards[id]?.zone.kind).toBe("library");
      for (const id of rest) expect(g.state.cards[id]?.revealedTo).toEqual([]);
      expect((g.state.zones.hand.p1 ?? []).length).toBe(handBefore + 0);
    }
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
