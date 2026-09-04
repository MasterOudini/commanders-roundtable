// `Zephyr Winder` - every declared pick is accepted and it untaps; a permanent the clause
// excludes is refused (D299). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZEPHYR_WINDER_SCRIPT } from './zephyrWinder';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Zephyr Winder";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Zephyr Winder", "Grizzly Bears", "Forest"], ["Grizzly Bears"]],
    scripts: createRegistry([ZEPHYR_WINDER_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p1', "Grizzly Bears");
  const wrong = put(g, 'p1', "Forest");
  settle(g);
  const life0 = g.state.players.p1?.life ?? 0;
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [target], tapped: true }));
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
  // Unblocked: the damage step fires the trigger, which asks for its targets.
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, self, target, wrong, life0 };
}

describe("Zephyr Winder", () => {
  test("Grizzly Bears (tapped) is accepted and it untaps", () => {
    const { g, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(g.state.cards[target]?.tapped).toBe(false);
  });

  test("Forest is refused (D299)", () => {
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
