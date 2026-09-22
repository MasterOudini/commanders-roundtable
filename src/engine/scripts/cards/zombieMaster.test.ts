// `Zombie Master` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ZOMBIE_MASTER_SCRIPT } from './zombieMaster';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import { legalActions } from '../../legal';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Zombie Master";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; yes: InstanceId; murder: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([ZOMBIE_MASTER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function lw(g: Game, id: InstanceId): readonly string[] {
  const d = deps(createRegistry([ZOMBIE_MASTER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).landwalk;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Zombie Master", "Scathe Zombies", "Murder"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([ZOMBIE_MASTER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Scathe Zombies");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const murder = put(g, 'p1', "Murder", 'hand');
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    settle(g);
    }
  if (which === 1) {
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    { const grantOffer = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((x) => x.t === 'ActivateAbility' && x.card === yes && x.grantRef !== undefined);
      if (!grantOffer || grantOffer.t !== 'ActivateAbility' || grantOffer.grantRef === undefined) throw new Error('no granted offer on the host');
      must(g.submit({ t: 'ActivateAbility', player: 'p1', card: yes, abilityIndex: grantOffer.abilityIndex, grantRef: grantOffer.grantRef }));
    }
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: murder, targets: [{ kind: 'card', id: yes }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, yes, murder };
}

describe("Zombie Master", () => {
  test("Other Zombie creatures have swampwalk. (They can't be blocked as long as defending player controls a Swamp.): only the Zombie reads it", () => {
    const { g, no, yes } = armed(0);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(lw(g, yes)).toContain("Swamp");
    expect(lw(g, no)).not.toContain("Swamp");
  });

  test("Other Zombies have \"{B}: only the Zombie reads it", () => {
    const { g, no } = armed(1);
    expect(pt(g, no)).toEqual([5, 2]);
  });

  test("Other Zombies have \"{B}: the vocabulary resolves \"Regenerate this permanent.\"", () => {
    const { g, yes } = armed(2);
    expect(g.state.cards[yes]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[yes]?.tapped).toBe(true);
    expect(g.state.cards[yes]?.damage).toBe(0);
    expect(g.state.regenerationShields[yes] ?? 0).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
