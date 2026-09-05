// `Brigone, Soldier of Meletis` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRIGONE_SOLDIER_OF_MELETIS_SCRIPT } from './brigoneSoldierOfMeletis';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Brigone, Soldier of Meletis";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; cnt0: number; pt0: [number | null, number | null] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([BRIGONE_SOLDIER_OF_MELETIS_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Brigone, Soldier of Meletis", "Giant Growth"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([BRIGONE_SOLDIER_OF_MELETIS_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const growth = put(g, 'p1', 'Giant Growth', 'hand');
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  let cnt0 = 0;
  let pt0: [number | null, number | null] = [null, null];
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: growth, targets: [{ kind: 'card', id: self }] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: "+1/+1", delta: 1 }));
    cnt0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    pt0 = pt(g, self);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, cnt0, pt0 };
}

describe("Brigone, Soldier of Meletis", () => {
  test("Heroic — Whenever you cast a spell that targets Brigone: it gets 1 +1/+1 counter", () => {
    const { g, self } = armed(0);
    expect(g.state.cards[self]?.counters["+1/+1"] ?? 0).toBe(1);
  });

  test("{T}, Remove a +1/+1 counter from Brigone: a card is drawn", () => {
    const { g, self, hand0, cnt0 } = armed(1);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(g.state.cards[self]?.counters["+1/+1"] ?? 0).toBe(cnt0 - 1);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
