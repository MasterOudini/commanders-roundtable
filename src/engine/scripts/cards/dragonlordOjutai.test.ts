// `Dragonlord Ojutai` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { DRAGONLORD_OJUTAI_SCRIPT } from './dragonlordOjutai';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Dragonlord Ojutai";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; condOff: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([DRAGONLORD_OJUTAI_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([DRAGONLORD_OJUTAI_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Dragonlord Ojutai"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([DRAGONLORD_OJUTAI_SCRIPT]),
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
  let condOff = false;
  if (which === 0) {
    // D398 - stage one: the condition holds on the armed board, so it is broken first.
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: true }));
    settle(g);
    condOff = !kw(g, self).has("hexproof");
    // D398 - stage two: the condition is met.
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || s.priority.awaiting?.kind === 'proliferateChoice' || (s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain'), 20_000);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, condOff };
}

describe("Dragonlord Ojutai", () => {
  test("`Dragonlord Ojutai` - as long as it's untapped: absent while it is unmet, read once it holds", () => {
    const { g, self, condOff } = armed(0);
    expect(pt(g, self)).toEqual([5, 4]);
    expect(kw(g, self).has("hexproof")).toBe(true);
    expect(condOff, 'the static is absent while the condition is unmet').toBe(true);
  });

  test("Whenever Dragonlord Ojutai deals combat damage to a player: the vocabulary resolves \"Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.\"", () => {
    const { g } = armed(1);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    { const shown = (g.state.zones.library.p1 ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
      const picks = shown.slice(Math.max(0, shown.length - 1));
      const rest = shown.filter((id) => !picks.includes(id));
      const handBefore = (g.state.zones.hand.p1 ?? []).length;
      must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: picks }));
      if (rest.length > 1) {
        advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 20_000);
        must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: rest }));
      }
      settle(g);
      for (const id of picks) expect(g.state.cards[id]?.zone).toEqual({ kind: 'hand', player: 'p1' });
      for (const id of rest) expect(g.state.cards[id]?.zone.kind).toBe("library");
      for (const id of rest) expect(g.state.cards[id]?.revealedTo).toEqual([]);
      expect((g.state.zones.hand.p1 ?? []).length).toBe(handBefore + picks.length);
    }
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
