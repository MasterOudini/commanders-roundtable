// `Spike Feeder` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPIKE_FEEDER_SCRIPT } from './spikeFeeder';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Spike Feeder";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; cnt0: number; pt0: [number | null, number | null] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([SPIKE_FEEDER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Spike Feeder"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SPIKE_FEEDER_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  if (![true,false,false][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
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
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: "+1/+1", delta: 1 }));
    cnt0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    pt0 = pt(g, self);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: "+1/+1", delta: 1 }));
    cnt0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    pt0 = pt(g, self);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, cnt0, pt0 };
}

describe("Spike Feeder", () => {
  test("This creature enters with two +1/+1 counters on it.: cast, it enters with 2 +1/+1 counters", () => {
    const { g, self } = armed(0);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.counters['+1/+1'] ?? 0).toBe(2);
    expect(pt(g, self)).toEqual([2, 2]);
  });

  test("{2}, Remove a +1/+1 counter from this creature: the declared creature gets 1 +1/+1 counter", () => {
    const { g, self, no, cnt0 } = armed(1);
    expect(g.state.cards[no]?.counters["+1/+1"] ?? 0).toBe(1);
    expect(g.state.cards[self]?.counters["+1/+1"] ?? 0).toBe(cnt0 - 1);
  });

  test("Remove a +1/+1 counter from this creature: 2 life is gained", () => {
    const { g, self, life0, cnt0 } = armed(2);
    expect(g.state.players.p1?.life).toBe(life0 + 2);
    expect(g.state.cards[self]?.counters["+1/+1"] ?? 0).toBe(cnt0 - 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
