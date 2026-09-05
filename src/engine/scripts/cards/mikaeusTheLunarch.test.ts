// `Mikaeus, the Lunarch` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MIKAEUS_THE_LUNARCH_SCRIPT } from './mikaeusTheLunarch';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Mikaeus, the Lunarch";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; yes: InstanceId; cnt0: number; pt0: [number | null, number | null] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([MIKAEUS_THE_LUNARCH_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Mikaeus, the Lunarch", "Coral Eel"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([MIKAEUS_THE_LUNARCH_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  if (![true,false,false][which]) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, xValue: 2 }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  let cnt0 = 0;
  let pt0: [number | null, number | null] = [null, null];
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, xValue: 2 }));
    settle(g);
    }
  if (which === 1) {
    cnt0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: "+1/+1", delta: 1 }));
    cnt0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    pt0 = pt(g, self);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, yes, cnt0, pt0 };
}

describe("Mikaeus, the Lunarch", () => {
  test("Mikaeus enters with X +1/+1 counters on it.: cast with X = 2, it enters with 2 +1/+1 counters", () => {
    const { g, self } = armed(0);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.counters['+1/+1'] ?? 0).toBe(2);
    expect(pt(g, self)).toEqual([2, 2]);
  });

  test("{T}: it gets 1 +1/+1 counter", () => {
    const { g, self, cnt0 } = armed(1);
    expect(g.state.cards[self]?.counters["+1/+1"] ?? 0).toBe(cnt0 + 1);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test("{T}, Remove a +1/+1 counter from Mikaeus: each of its controller's creatures gets 1 +1/+1 counter", () => {
    const { g, self, no, yes, cnt0 } = armed(2);
    expect(g.state.cards[yes]?.counters["+1/+1"] ?? 0).toBe(1);
    expect(g.state.cards[no]?.counters["+1/+1"] ?? 0).toBe(0);
    expect(g.state.cards[self]?.counters["+1/+1"] ?? 0).toBe(cnt0 - 1);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
