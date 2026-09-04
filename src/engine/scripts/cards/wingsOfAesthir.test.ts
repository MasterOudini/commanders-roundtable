// `Wings of Aesthir` - cast on Grizzly Bears it attaches and the enchanted creature gets +1/+0 and has flying, firstStrike;
// the other creature is untouched; the host dying drops the Aura
// (CR 704.5m); the replay hash (D304). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WINGS_OF_AESTHIR_SCRIPT } from './wingsOfAesthir';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Wings of Aesthir";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([WINGS_OF_AESTHIR_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([WINGS_OF_AESTHIR_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function board(): { g: Game; self: InstanceId; host: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([WINGS_OF_AESTHIR_SCRIPT]),
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
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

describe("Wings of Aesthir", () => {
  test("on Grizzly Bears: attached, and the enchanted creature gets +1/+0 and has flying, firstStrike; Cyclops of One-Eyed Pass is untouched", () => {
    const { g, self, host, other } = board();
    cast(g, self, host);
    expect(g.state.cards[self]?.attachedTo).toBe(host);
    expect(pt(g, host)).toEqual([3, 2]);
    expect(kw(g, host).has("flying")).toBe(true);
    expect(kw(g, host).has("firstStrike")).toBe(true);
    expect(pt(g, other)).toEqual([5, 2]);
    expect(kw(g, other).has("flying")).toBe(false);
    expect(kw(g, other).has("firstStrike")).toBe(false);
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
