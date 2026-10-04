// `Radha, Heart of Keld` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { RADHA_HEART_OF_KELD_SCRIPT } from './radhaHeartOfKeld';
import { advanceUntil, deps, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import { seesTop } from '../../topOfLibrary';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Radha, Heart of Keld";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; condOff: boolean; cntBayou: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([RADHA_HEART_OF_KELD_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([RADHA_HEART_OF_KELD_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Radha, Heart of Keld", "Bayou", "Forest", "Forest"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([RADHA_HEART_OF_KELD_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const cntBayou = put(g, 'p1', "Bayou");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const energy0 = g.state.players.p1?.energy ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  let condOff = false;
  if (which === 0) {
    // D398 - stage one: the condition holds on the armed board, so it is broken first.
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null, 40_000);
    settle(g);
    condOff = !kw(g, self).has("firstStrike");
    // D398 - stage two: the condition is met.
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    const topLand = (Object.keys(g.state.cards) as InstanceId[]).find((id) => nameOf(g, id) === "Forest" && (g.state.cards[id]?.zone.kind === 'library' || g.state.cards[id]?.zone.kind === 'hand') && g.state.cards[id]?.zone.player === 'p1');
    if (!topLand) throw new Error("Forest is dealt for the top");
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: topLand, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    must(g.submit({ t: 'PlayLand', player: 'p1', card: topLand }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, condOff, cntBayou };
}

describe("Radha, Heart of Keld", () => {
  test("`Radha, Heart of Keld` - as long as it's your turn: absent while it is unmet, read once it holds", () => {
    const { g, self, condOff } = armed(0);
    expect(pt(g, self)).toEqual([3, 3]);
    expect(kw(g, self).has("firstStrike")).toBe(true);
    expect(condOff, 'the static is absent while the condition is unmet').toBe(true);
  });

  test("You may look at the top card of your library any time, and you may play lands from the top of your library.: its owner sees the top card of the library; a land is played from the top", () => {
    const { g } = armed(1);
    expect(seesTop(g.state, g.deps.oracle, g.deps.scripts, 'p1', 'p1'), 'its owner sees the top card').toBe(true);
    expect(seesTop(g.state, g.deps.oracle, g.deps.scripts, 'p2', 'p1'), "a look is its owner alone").toBe(false);
    expect(g.log.some((ev) => ev.body.t === 'CardsMoved' && ev.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'battlefield' && nameOf(g, m.card) === 'Forest')), 'a land played from the top').toBe(true);
  });

  test("{4}{R}{G}: the vocabulary resolves \"~ gets +X/+X until end of turn, where X is the number of lands you control.\"", () => {
    const { g, self } = armed(2);
    expect(g.log.some((x) => x.body.t === 'PtModifiedUntilEndOfTurn' && x.body.card === self && x.body.power === 1 && x.body.toughness === 1), 'the pump on the card').toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
