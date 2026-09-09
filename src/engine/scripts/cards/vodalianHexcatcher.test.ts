// `Vodalian Hexcatcher` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { VODALIAN_HEXCATCHER_SCRIPT } from './vodalianHexcatcher';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Vodalian Hexcatcher";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; yes: InstanceId; vtA0_0: InstanceId; payA0_p2_0: InstanceId; fodder0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([VODALIAN_HEXCATCHER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Vodalian Hexcatcher", "Merfolk of the Pearl Trident"], ["Cyclops of One-Eyed Pass", "Divination", "Forest"]],
    scripts: createRegistry([VODALIAN_HEXCATCHER_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Merfolk of the Pearl Trident");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtA0_0 = put(g, 'p2', "Divination", 'hand');
  const payA0_p2_0 = put(g, 'p2', "Forest");
  const fodder0 = [put(g, 'p1', "Merfolk of the Pearl Trident")];
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
  if (which === 0) {
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber >= 4 && s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: vtA0_0 }));
    advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const stackId = g.state.stack[0]?.id as string;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0.slice(0, 1) }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, yes, vtA0_0, payA0_p2_0, fodder0 };
}

describe("Vodalian Hexcatcher", () => {
  test("Other Merfolk you control get +1/+1.: only the Merfolk reads it", () => {
    const { g, no, yes } = armed(0);
    expect(pt(g, yes)).toEqual([2, 2]);
    expect(pt(g, no)).toEqual([5, 2]);
  });

  test("Sacrifice a Merfolk: the vocabulary resolves \"Counter target noncreature spell unless its controller pays {1}.\" - the price is declined", () => {
    const { g, payA0_p2_0, fodder0 } = armed(1);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p2"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p2", pay: false }));
    settle(g);
    expect(g.state.cards[payA0_p2_0]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.log.some((e) => e.body.t === 'SpellCountered'), 'the price decides whether the spell is countered').toBe(true);
    for (const f of fodder0.slice(0, 1)) expect(g.state.cards[f]?.zone.kind).toBe('graveyard');
  });

  test("Sacrifice a Merfolk: the vocabulary resolves \"Counter target noncreature spell unless its controller pays {1}.\" - the price is paid", () => {
    const { g, payA0_p2_0, fodder0 } = armed(1);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p2"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p2", pay: true }));
    settle(g);
    expect(g.state.cards[payA0_p2_0]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.log.some((e) => e.body.t === 'SpellCountered'), 'the price decides whether the spell is countered').toBe(false);
    for (const f of fodder0.slice(0, 1)) expect(g.state.cards[f]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
