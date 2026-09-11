// `Adanto Vanguard` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ADANTO_VANGUARD_SCRIPT } from './adantoVanguard';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Adanto Vanguard";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; condOff: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([ADANTO_VANGUARD_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([ADANTO_VANGUARD_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Adanto Vanguard"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([ADANTO_VANGUARD_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
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
  let condOff = false;
  if (which === 0) {
    condOff = pt(g, self)[0] === 1 && pt(g, self)[1] === 1;
    // D398 - stage two: the condition is met.
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.combat !== null && s.combat.attackers.length > 0 && s.priority.awaiting === null, 200);
    }
  if (which === 1) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, condOff };
}

describe("Adanto Vanguard", () => {
  test("`Adanto Vanguard` - as long as this creature is attacking: absent while it is unmet, read once it holds", () => {
    const { g, self, condOff } = armed(0);
    expect(pt(g, self)).toEqual([3, 1]);
    expect(condOff, 'the static is absent while the condition is unmet').toBe(true);
  });

  test("Pay 4 life: it gains indestructible until end of turn", () => {
    const { g, self, life0 } = armed(1);
    expect(pt(g, self)).toEqual([1, 1]);
    expect(kw(g, self).has("indestructible")).toBe(true);
    expect(g.state.players.p1?.life).toBe(life0 - 4);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
