// `Swarm Guildmage` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SWARM_GUILDMAGE_SCRIPT } from './swarmGuildmage';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Swarm Guildmage";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; yes: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([SWARM_GUILDMAGE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([SWARM_GUILDMAGE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Swarm Guildmage", "Coral Eel"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SWARM_GUILDMAGE_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, yes };
}

describe("Swarm Guildmage", () => {
  test("{4}{B}, {T}: its controller's creatures get +1/+0 and gain menace until end of turn", () => {
    const { g, self, no, yes } = armed(0);
    expect(pt(g, yes)).toEqual([3, 1]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("menace")).toBe(true);
    expect(kw(g, no).has("menace")).toBe(false);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test("{1}{G}, {T}: 2 life is gained", () => {
    const { g, self, life0 } = armed(1);
    expect(g.state.players.p1?.life).toBe(life0 + 2);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('the pump ends at cleanup', () => {
    const { g, yes } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(kw(g, yes).has("menace")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
