// `Nightmare Sower` - every declared pick is accepted and it gets a -1/-1 counter; a permanent the clause
// excludes is refused (D299). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NIGHTMARE_SOWER_SCRIPT } from './nightmareSower';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Nightmare Sower";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Nightmare Sower", "Pyretic Ritual"], ["Grizzly Bears", "Forest"]],
    scripts: createRegistry([NIGHTMARE_SOWER_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p2', "Grizzly Bears");
  const wrong = put(g, 'p2', "Forest");
  settle(g);
  // p2's second turn, p1 holding priority in p2's main phase: a spell cast on an opponent's turn.
  advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const ritual = put(g, 'p1', "Pyretic Ritual", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, self, target, wrong, life0 };
}

describe("Nightmare Sower", () => {
  test("Grizzly Bears is accepted and it gets a -1/-1 counter", () => {
    const { g, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(g.state.cards[target]?.counters['-1/-1']).toBe(1);
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
