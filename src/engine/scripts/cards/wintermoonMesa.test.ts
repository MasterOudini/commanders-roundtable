// `Wintermoon Mesa` - every declared pick is accepted and it is tapped; a permanent the clause
// excludes is refused beside a legal one (D299). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WINTERMOON_MESA_SCRIPT } from './wintermoonMesa';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Wintermoon Mesa";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; target2: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Wintermoon Mesa"], ["Forest", "Quicksand", "Grizzly Bears"]],
    scripts: createRegistry([WINTERMOON_MESA_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p2', "Forest");
  const target2 = put(g, 'p2', "Quicksand");
  const wrong = put(g, 'p2', "Grizzly Bears");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
  return { g, self, target, target2, wrong, life0 };
}

describe("Wintermoon Mesa", () => {
  test("each of Forest and Quicksand is accepted and it is tapped", () => {
    const { g, self, target, target2 } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }, { kind: 'card', id: target2 }] }));
    settle(g);
    expect(g.state.cards[target]?.tapped).toBe(true);
    expect(g.state.cards[target2]?.tapped).toBe(true);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test("Grizzly Bears is refused (D299)", () => {
    const { g, wrong, target2 } = armed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wrong }, { kind: 'card', id: target2 }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, target, target2 } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }, { kind: 'card', id: target2 }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
