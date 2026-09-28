// `Duskwatch Recruiter // Krallenhorde Howler` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER_SCRIPT } from './duskwatchRecruiterKrallenhordeHowler';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Duskwatch Recruiter // Krallenhorde Howler";

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
    decks: [["Duskwatch Recruiter // Krallenhorde Howler", "Grizzly Bears", "Grizzly Bears", "Pyretic Ritual", "Pyretic Ritual", "Pyretic Ritual", "Pyretic Ritual"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  faceUp(g, self, [0,0,1][which] ?? 0);
  if (![false,true,true][which]) {
    const hold = put(g, 'p1', 'Pyretic Ritual', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: hold }));
    settle(g);
  }
  if (which === 1) {
    { const rit0 = put(g, 'p1', 'Pyretic Ritual', 'hand');
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
        must(g.submit({ t: 'CastSpell', player: 'p1', card: rit0 }));
      settle(g); }
      { const fired0 = g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length;
      advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'upkeep', 40_000);
      settle(g);
      if (g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length !== fired0) throw new Error('the trigger fired with its condition unmet');
    }
    }
  if (which === 2) {
    { const rit0 = put(g, 'p1', 'Pyretic Ritual', 'hand');
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
        must(g.submit({ t: 'CastSpell', player: 'p1', card: rit0 }));
      settle(g); }
      { const fired0 = g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length;
      advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'upkeep', 40_000);
      settle(g);
      if (g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length !== fired0) throw new Error('the trigger fired with its condition unmet');
    }
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.stack.length === 0 && s.priority.awaiting === null, 40_000);
    { const rit1 = put(g, 'p1', 'Pyretic Ritual', 'hand');
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
        must(g.submit({ t: 'CastSpell', player: 'p1', card: rit1 }));
      settle(g); }
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.stack.length === 0 && s.priority.awaiting === null, 40_000);
    { const rit2 = put(g, 'p1', 'Pyretic Ritual', 'hand');
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
        must(g.submit({ t: 'CastSpell', player: 'p1', card: rit2 }));
      settle(g); }
    }
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
    const lookPicksA0 = (Object.keys(g.state.cards) as InstanceId[]).filter((id) => nameOf(g, id) === "Grizzly Bears" && (g.state.cards[id]?.zone.kind === 'library' || g.state.cards[id]?.zone.kind === 'hand'));
    expect(lookPicksA0.length, "Grizzly Bears is dealt for the look").toBeGreaterThan(0);
    for (const id of lookPicksA0) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 60_000);
    settle(g);
    }
  if (which === 2) {
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 60_000);
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Duskwatch Recruiter // Krallenhorde Howler", () => {
  test("{2}{G}: the vocabulary resolves \"Look at the top three cards of your library. You may reveal a creature card from among them and put it into your hand. Put the rest on the bottom of your library in any order.\"", () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    { const shown = (g.state.zones.library.p1 ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
      const found = shown.find((id) => nameOf(g, id) === "Grizzly Bears");
      expect(found, "Grizzly Bears is not among the revealed cards").toBeDefined();
      const picks = [found as InstanceId];
      const rest = shown.filter((id) => !picks.includes(id));
      const handBefore = (g.state.zones.hand.p1 ?? []).length;
      must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: picks }));
      if (rest.length > 1) {
        advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 20_000);
        must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: rest }));
      }
      settle(g);
      for (const id of picks) expect(g.state.cards[id]?.zone).toEqual({ kind: "hand", player: 'p1' });
      for (const id of rest) expect(g.state.cards[id]?.zone.kind).toBe("library");
      for (const id of rest) expect(g.state.cards[id]?.revealedTo).toEqual([]);
      expect((g.state.zones.hand.p1 ?? []).length).toBe(handBefore + picks.length);
    }
  });

  test("At the beginning of each upkeep: the vocabulary resolves \"Transform this creature.\"", () => {
    const { g, self } = armed(1);
    expect(g.state.cards[self]?.faceIndex ?? 0, 'transformed').toBe(1);
  });

  test("At the beginning of each upkeep: the vocabulary resolves \"Transform this creature.\"", () => {
    const { g, self } = armed(2);
    expect(g.state.cards[self]?.faceIndex ?? 0, 'transformed').toBe(0);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
