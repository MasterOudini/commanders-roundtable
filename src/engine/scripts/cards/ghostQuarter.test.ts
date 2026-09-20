// `Ghost Quarter` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { GHOST_QUARTER_SCRIPT } from './ghostQuarter';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Ghost Quarter";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; vtA1_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Ghost Quarter"], ["Cyclops of One-Eyed Pass", "Forest", "Forest"]],
    scripts: createRegistry([GHOST_QUARTER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtA1_0 = put(g, 'p2', "Forest");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA1_0 }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, vtA1_0 };
}

describe("Ghost Quarter", () => {
  test("{T}, Sacrifice this land: the vocabulary resolves \"Destroy target land. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.\"", () => {
    const { g, self, vtA1_0 } = armed(0);
    expect(g.state.cards[vtA1_0]?.zone.kind).toBe('graveyard');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    { const stray = Object.keys(g.state.cards).find((id) => nameOf(g, id as InstanceId) === "Forest" && g.state.cards[id as InstanceId]?.zone.kind === 'hand' && g.state.cards[id as InstanceId]?.zone.player === 'p2');
      if (stray) must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: stray as InstanceId, to: { kind: 'library', player: 'p2' } }));
      must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [], declined: false }));
      const lib = [...(g.state.zones.library.p2 ?? [])];
      const found = lib.find((id) => nameOf(g, id) === "Forest");
      expect(found, "Forest is not in the library for the search to find").toBeDefined();
      must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [found as InstanceId], declined: false }));
      settle(g);
      expect(g.state.cards[found as InstanceId]?.zone).toEqual({ kind: "battlefield", player: 'p2' });
    }
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
