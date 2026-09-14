// `Spirit Bonds` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SPIRIT_BONDS_SCRIPT } from './spiritBonds';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Spirit Bonds";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; bears: InstanceId; payL0_p1_0: InstanceId; fodder0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([SPIRIT_BONDS_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([SPIRIT_BONDS_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Spirit Bonds", "Bile Urchin", "Grizzly Bears", "Crimson Kobolds", "Plains"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SPIRIT_BONDS_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const payL0_p1_0 = put(g, 'p1', "Plains");
  const fodder0 = [put(g, 'p1', "Bile Urchin")];
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  let hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  let bears: InstanceId = self;
  if (which === 0) {
    bears = put(g, 'p1', "Crimson Kobolds");
    hand0 = (g.state.zones.hand.p1 ?? []).length;
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0.slice(0, 1) }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, bears, payL0_p1_0, fodder0 };
}

describe("Spirit Bonds", () => {
  test("Whenever a nontoken creature you control enters: the vocabulary resolves \"You may pay {W}. If you do, create a 1/1 white Spirit creature token with flying.\" - the price is declined", () => {
    const { g, payL0_p1_0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    settle(g);
    expect(g.state.cards[payL0_p1_0]?.tapped, 'declining costs nothing').toBe(false);
  });

  test("Whenever a nontoken creature you control enters: the vocabulary resolves \"You may pay {W}. If you do, create a 1/1 white Spirit creature token with flying.\" - the price is paid", () => {
    const { g, board0, payL0_p1_0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true }));
    settle(g);
    expect(g.state.cards[payL0_p1_0]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(onBoard(g)).toBe(board0 + 1 + 1);
  });

  test("{1}{W}, Sacrifice a Spirit: the vocabulary resolves \"Target non-Spirit creature gains indestructible until end of turn.\"", () => {
    const { g, no, fodder0 } = armed(1);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, no).has("indestructible")).toBe(true);
    for (const f of fodder0.slice(0, 1)) expect(g.state.cards[f]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
