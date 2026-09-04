// `Vault of the Archangel` - the printed cost buys the pump until end of turn; it ends at cleanup;
// replay equal (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VAULT_OF_THE_ARCHANGEL_SCRIPT } from './vaultOfTheArchangel';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Vault of the Archangel";

type Armed = { g: Game; self: InstanceId; life0: number; yes: InstanceId; no: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([VAULT_OF_THE_ARCHANGEL_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([VAULT_OF_THE_ARCHANGEL_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Vault of the Archangel", "Coral Eel"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([VAULT_OF_THE_ARCHANGEL_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
      must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    settle(g);
  }
  return { g, self, life0, yes, no };
}

describe("Vault of the Archangel", () => {
  test("{2}{W}{B}, {T}: its controller's creatures gain deathtouch and lifelink until end of turn", () => {
    const { g, self, yes, no } = armed(0);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("deathtouch")).toBe(true);
    expect(kw(g, no).has("deathtouch")).toBe(false);
    expect(kw(g, yes).has("lifelink")).toBe(true);
    expect(kw(g, no).has("lifelink")).toBe(false);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('the pump ends at cleanup', () => {
    const { g, yes } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(kw(g, yes).has("deathtouch")).toBe(false);
    expect(kw(g, yes).has("lifelink")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
