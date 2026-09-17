// `Alpine Guide` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ALPINE_GUIDE_SCRIPT } from './alpineGuide';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Alpine Guide";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; refused: boolean; queueFodderL2_leavesBattlefield: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Alpine Guide", "Grizzly Bears", "Mountain", "Mountain"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([ALPINE_GUIDE_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const queueFodderL2_leavesBattlefield = put(g, 'p1', "Mountain");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,null,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
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
  let refused = false;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const ask = g.state.priority.awaiting;
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: ask && ask.kind === 'optionalTrigger' ? ask.stackId : '', accept: true }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    refused = !g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [] }).ok;
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'exile', player: 'p1' } }));
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, refused, queueFodderL2_leavesBattlefield };
}

describe("Alpine Guide", () => {
  test("When this creature enters: the vocabulary resolves \"Search your library for a Mountain card, put that card onto the battlefield tapped, then shuffle.\"", () => {
    const { g, board0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    { const stray = Object.keys(g.state.cards).find((id) => nameOf(g, id as InstanceId) === "Mountain" && g.state.cards[id as InstanceId]?.zone.kind === 'hand');
      if (stray) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: stray as InstanceId, to: { kind: 'library', player: 'p1' } }));
      const lib = [...(g.state.zones.library.p1 ?? [])];
      const found = lib.find((id) => nameOf(g, id) === "Mountain");
      expect(found, "Mountain is not in the library for the search to find").toBeDefined();
      must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [found as InstanceId], declined: false }));
      settle(g);
      expect(g.state.cards[found as InstanceId]?.zone).toEqual({ kind: "battlefield", player: 'p1' });
      expect(g.state.cards[found as InstanceId]?.tapped, 'the card the search found arrives tapped').toBe(true);
    }
    expect(onBoard(g)).toBe(board0 + 1 + 1);
  });

  test("This creature attacks each combat if able.: an empty declaration is refused, then it attacks", () => {
    const { g, self, refused } = armed(1);
    expect(refused).toBe(true);
    expect(g.state.combat?.attackers.some((x) => x.card === self) ?? false).toBe(true);
  });

  test("When this creature leaves the battlefield: the vocabulary resolves \"Sacrifice a Mountain.\"", () => {
    const { g, board0, queueFodderL2_leavesBattlefield } = armed(2);
    for (let qi = 0; qi < 4; qi++) {
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null), 20_000);
      const qa = g.state.priority.awaiting;
      if (qa?.kind !== 'chooseFromZone' || qa.zone !== 'battlefield') break;
      if (qa.player === 'p1') { must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [queueFodderL2_leavesBattlefield] })); continue; }
      let qDone = false;
      for (const qc of g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === qa.player)) {
        if (g.submit({ t: 'AnswerChooseFromZone', player: qa.player, cards: [qc] }).ok) { qDone = true; break; }
      }
      expect(qDone, 'the queued sacrifice could be answered for ' + qa.player).toBe(true);
    }
    settle(g);
    expect(g.state.pendingAsks).toBeNull();
    expect(g.state.cards[queueFodderL2_leavesBattlefield]?.zone.kind).toBe('graveyard');
    expect(onBoard(g)).toBe(board0 + -1 - 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
