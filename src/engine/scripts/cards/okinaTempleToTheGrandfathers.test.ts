// `Okina, Temple to the Grandfathers` - the named target is accepted and the pump lands; a permanent the adjective excludes
// is refused (D294). Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OKINA_TEMPLE_TO_THE_GRANDFATHERS_SCRIPT } from './okinaTempleToTheGrandfathers';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Okina, Temple to the Grandfathers";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Okina, Temple to the Grandfathers", "Lady Caleria", "Grizzly Bears"], ["Grizzly Bears"]],
    scripts: createRegistry([OKINA_TEMPLE_TO_THE_GRANDFATHERS_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p1', "Lady Caleria");
  const wrong = put(g, 'p1', "Grizzly Bears");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
  return { g, self, target, wrong, life0 };
}

describe("Okina, Temple to the Grandfathers", () => {
  test("Lady Caleria is a legal target and the pump lands", () => {
    const { g, self, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    const d = deps(createRegistry([OKINA_TEMPLE_TO_THE_GRANDFATHERS_SCRIPT]));
    const got = derive(g.state, d.oracle, d.scripts, target);
    expect([got.power, got.toughness]).toEqual([4, 7]);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test("Grizzly Bears is refused (D294)", () => {
    const { g, wrong } = armed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wrong }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
