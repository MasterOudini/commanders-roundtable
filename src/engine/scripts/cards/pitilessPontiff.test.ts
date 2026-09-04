// `Pitiless Pontiff` - the printed cost buys the pump until end of turn; it ends at cleanup;
// replay equal (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PITILESS_PONTIFF_SCRIPT } from './pitilessPontiff';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Pitiless Pontiff";

type Armed = { g: Game; self: InstanceId; life0: number; fodder: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([PITILESS_PONTIFF_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([PITILESS_PONTIFF_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Pitiless Pontiff", "Grizzly Bears"], ["Grizzly Bears"]],
    scripts: createRegistry([PITILESS_PONTIFF_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const fodder = put(g, 'p1', "Grizzly Bears");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
      must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder }));
    settle(g);
  }
  return { g, self, life0, fodder };
}

describe("Pitiless Pontiff", () => {
  test("{1}, Sacrifice another creature: it gains deathtouch and indestructible until end of turn", () => {
    const { g, self, fodder } = armed(0);
    expect(pt(g, self)).toEqual([2, 2]);
    expect(kw(g, self).has("deathtouch")).toBe(true);
    expect(kw(g, self).has("indestructible")).toBe(true);
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
  });

  test('the pump ends at cleanup', () => {
    const { g, self } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(pt(g, self)).toEqual([2, 2]);
    expect(kw(g, self).has("deathtouch")).toBe(false);
    expect(kw(g, self).has("indestructible")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
