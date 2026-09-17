// `Vivien Reid` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { VIVIEN_REID_SCRIPT } from './vivienReid';
import { VIVIEN_REID_EMBLEM1CF97003_SCRIPT } from './vivienReidEmblem1cf97003';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Vivien Reid";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; refused: boolean; vtA1_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Vivien Reid", "Grizzly Bears", "Forest", "Forest"], ["Cyclops of One-Eyed Pass", "Sol Ring"]],
    scripts: createRegistry([VIVIEN_REID_SCRIPT, VIVIEN_REID_EMBLEM1CF97003_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtA1_0 = put(g, 'p2', "Sol Ring");
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
  let refused = false;
  if (which === 0) {
    const lookPicksA0 = (Object.keys(g.state.cards) as InstanceId[]).filter((id) => nameOf(g, id) === "Forest" && (g.state.cards[id]?.zone.kind === 'library' || g.state.cards[id]?.zone.kind === 'hand'));
    expect(lookPicksA0.length, "Forest is dealt for the look").toBeGreaterThan(0);
    for (const id of lookPicksA0) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA1_0 }] }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'loyalty', delta: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, refused, vtA1_0 };
}

describe("Vivien Reid", () => {
  test("+1: the vocabulary resolves \"Look at the top four cards of your library. You may reveal a creature or land card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.\"", () => {
    const { g, self } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    { const shown = (g.state.zones.library.p1 ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
      const found = shown.find((id) => nameOf(g, id) === "Forest");
      expect(found, "Forest is not among the revealed cards").toBeDefined();
      const picks = [found as InstanceId];
      const rest = shown.filter((id) => !picks.includes(id));
      const handBefore = (g.state.zones.hand.p1 ?? []).length;
      must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: picks }));
      settle(g);
      for (const id of picks) expect(g.state.cards[id]?.zone).toEqual({ kind: 'hand', player: 'p1' });
      for (const id of rest) expect(g.state.cards[id]?.zone.kind).toBe("library");
      for (const id of rest) expect(g.state.cards[id]?.revealedTo).toEqual([]);
      expect((g.state.zones.hand.p1 ?? []).length).toBe(handBefore + picks.length);
    }
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); expect(!again.ok && again.reason === 'timingRestriction', 'once each turn').toBe(true); }
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(6);
  });

  test("−3: the vocabulary resolves \"Destroy target artifact, enchantment, or creature with flying.\"", () => {
    const { g, self, refused, vtA1_0 } = armed(1);
    expect(g.state.cards[vtA1_0]?.zone.kind).toBe('graveyard');
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(2);
  });

  test("−8: the vocabulary resolves \"You get an emblem with \\\"Creatures you control get +2/+2 and have vigilance, trample, and indestructible.\\\"\"", () => {
    const { g, self, refused } = armed(2);
    expect((g.state.zones.command.p1 ?? []).filter((c) => g.state.cards[c]?.printingId === "1cf97003-eef0-4c01-aee1-8a8264d8ef95").length, 'the emblem is in the command zone').toBe(1);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
