// `Rakdos Pit Dragon` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { RAKDOS_PIT_DRAGON_SCRIPT } from './rakdosPitDragon';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Rakdos Pit Dragon";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; condOff: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([RAKDOS_PIT_DRAGON_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([RAKDOS_PIT_DRAGON_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Rakdos Pit Dragon"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([RAKDOS_PIT_DRAGON_SCRIPT]),
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
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    settle(g);
    }
  if (which === 2) {
    // D398 - stage one: the condition holds on the armed board, so it is broken first.
    for (const c of [...(g.state.zones.hand.p1 ?? [])]) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: c, to: { kind: 'exile', player: 'p1' } }));
    for (let i = 0; i < 1; i++) {
      const top = (g.state.zones.library.p1 ?? [])[0] as InstanceId;
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: top, to: { kind: 'hand', player: 'p1' } }));
    }
    settle(g);
    condOff = !kw(g, self).has("doubleStrike");
    // D398 - stage two: the condition is met.
    for (const c of [...(g.state.zones.hand.p1 ?? [])]) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: c, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, condOff };
}

describe("Rakdos Pit Dragon", () => {
  test("{R}{R}: it gains flying until end of turn", () => {
    const { g, self } = armed(0);
    expect(pt(g, self)).toEqual([3, 3]);
    expect(kw(g, self).has("flying")).toBe(true);
  });

  test("{R}: it gets +1/+0 until end of turn", () => {
    const { g, self } = armed(1);
    expect(pt(g, self)).toEqual([4, 3]);
  });

  test("`Rakdos Pit Dragon` - as long as you have no cards in hand: absent while it is unmet, read once it holds", () => {
    const { g, self, condOff } = armed(2);
    expect(pt(g, self)).toEqual([3, 3]);
    expect(kw(g, self).has("doubleStrike")).toBe(true);
    expect(condOff, 'the static is absent while the condition is unmet').toBe(true);
  });

  test('the pump ends at cleanup', () => {
    const { g, self } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(pt(g, self)).toEqual([3, 3]);
    expect(kw(g, self).has("flying")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
