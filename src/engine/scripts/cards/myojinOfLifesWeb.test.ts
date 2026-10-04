// `Myojin of Life's Web` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { MYOJIN_OF_LIFES_WEB_SCRIPT } from './myojinOfLifesWeb';
import { advanceUntil, deps, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Myojin of Life's Web";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; condOff: boolean; cnt0: number; pt0: [number | null, number | null] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([MYOJIN_OF_LIFES_WEB_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([MYOJIN_OF_LIFES_WEB_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Myojin of Life's Web", "Grizzly Bears", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([MYOJIN_OF_LIFES_WEB_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  if (![true,null,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self }));
    settle(g);
    if (g.state.cards[self]?.zone.kind !== 'battlefield') throw new Error('stage one: the card did not enter');
    if ((g.state.cards[self]?.counters['+1/+1'] ?? 0) !== 0) throw new Error('the replacement applied with its condition unmet');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
      settle(g);
  }
  const life0 = g.state.players.p1?.life ?? 0;
  const energy0 = g.state.players.p1?.energy ?? 0;
  let hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  let condOff = false;
  let cnt0 = 0;
  let pt0: [number | null, number | null] = [null, null];
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self }));
    settle(g);
    }
  if (which === 1) {
    condOff = !kw(g, self).has("indestructible");
    // D398 - stage two: the condition is met.
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: "divinity", delta: 1 }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: "divinity", delta: 1 }));
    cnt0 = g.state.cards[self]?.counters["divinity"] ?? 0;
    pt0 = pt(g, self);
    { const inHand = (g.state.zones.hand.p1 ?? []).some((id) => nameOf(g, id) === "Grizzly Bears");
      const inLib = (g.state.zones.library.p1 ?? []).find((id) => nameOf(g, id) === "Grizzly Bears");
      if (!inHand) { expect(inLib, "Grizzly Bears is dealt for the hand put").toBeDefined(); must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: inLib as InstanceId, to: { kind: 'hand', player: 'p1' } })); } }
    hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, condOff, cnt0, pt0 };
}

describe("Myojin of Life's Web", () => {
  test("Myojin of Life's Web enters with a divinity counter on it if you cast it from your hand.: cast, it enters with 1 divinity counter", () => {
    const { g, self } = armed(0);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.counters["divinity"] ?? 0).toBe(1);
  });

  test("`Myojin of Life's Web` - as long as it has a divinity counter on it: absent while it is unmet, read once it holds", () => {
    const { g, self, condOff } = armed(1);
    expect(pt(g, self)).toEqual([8, 8]);
    expect(kw(g, self).has("indestructible")).toBe(true);
    expect(condOff, 'the static is absent while the condition is unmet').toBe(true);
  });

  test("Remove a divinity counter from Myojin of Life's Web: the vocabulary resolves \"Put any number of creature cards from your hand onto the battlefield.\"", () => {
    const { g, self, hand0, board0, cnt0 } = armed(2);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'chooseFromZone' && ask.zone === 'hand' && ask.to === 'battlefield' ? ask.player : null, 'the hand put asks p1').toBe('p1');
      const found = (g.state.zones.hand.p1 ?? []).find((id) => nameOf(g, id) === "Grizzly Bears");
      expect(found, "Grizzly Bears is in hand for the put").toBeDefined();
      must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [found as InstanceId] }));
      settle(g);
      expect(g.state.cards[found as InstanceId]?.zone).toEqual({ kind: 'battlefield', player: 'p1' });
      expect(g.state.cards[found as InstanceId]?.tapped, 'entered untapped').toBe(false);
    }
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + -1);
    expect(onBoard(g)).toBe(board0 + 1);
    expect(g.state.cards[self]?.counters["divinity"] ?? 0).toBe(cnt0 - 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
