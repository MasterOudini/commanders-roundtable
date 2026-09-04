// `Agent Bishop, Man in Black` - every declared pick is accepted and it gets a +1/+1 counter; a permanent the clause
// excludes is refused (D299). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AGENT_BISHOP_MAN_IN_BLACK_SCRIPT } from './agentBishopManInBlack';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Agent Bishop, Man in Black";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; target2: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Agent Bishop, Man in Black"], ["Grizzly Bears", "Vampire Nighthawk", "Forest"]],
    scripts: createRegistry([AGENT_BISHOP_MAN_IN_BLACK_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p2', "Grizzly Bears");
  const target2 = put(g, 'p2', "Vampire Nighthawk");
  const wrong = put(g, 'p2', "Forest");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  // The next stop that asks for targets is this turn's beginning of combat.
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, self, target, target2, wrong, life0 };
}

describe("Agent Bishop, Man in Black", () => {
  test("each of Grizzly Bears and Vampire Nighthawk is accepted and it gets a +1/+1 counter", () => {
    const { g, target, target2 } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }, { kind: 'card', id: target2 }] }));
    settle(g);
    expect(g.state.cards[target]?.counters['+1/+1']).toBe(1);
    expect(g.state.cards[target2]?.counters['+1/+1']).toBe(1);
  });

  test("Forest is refused (D299)", () => {
    const { g, wrong } = armed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wrong }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, target, target2 } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }, { kind: 'card', id: target2 }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
