// `Sheltering Boughs` - cast on Grizzly Bears it attaches and the enchanted creature (on entering: draw 1); gets +1/+3;
// the other creature is untouched; the host dying drops the Aura
// (CR 704.5m); the replay hash (D304). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHELTERING_BOUGHS_SCRIPT } from './shelteringBoughs';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Sheltering Boughs";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([SHELTERING_BOUGHS_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; host: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SHELTERING_BOUGHS_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', "Grizzly Bears");
  const other = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  // p1's third-turn main phase: the host is past summoning sickness; the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, self, host, other };
}

function cast(g: Game, self: InstanceId, target: InstanceId): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

describe("Sheltering Boughs", () => {
  test("on Grizzly Bears: attached, and the enchanted creature (on entering: draw 1); gets +1/+3; Cyclops of One-Eyed Pass is untouched", () => {
    const { g, self, host, other } = board();
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    cast(g, self, host);
    expect(g.state.cards[self]?.attachedTo).toBe(host);
    expect(pt(g, host)).toEqual([3, 5]);
    expect(pt(g, other)).toEqual([5, 2]);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 - 1 + 1);
  });

  test('the host dying drops the Aura (CR 704.5m)', () => {
    const { g, self, host } = board();
    cast(g, self, host);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: host, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, self, host } = board();
    cast(g, self, host);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
