// `Armaggon, Future Shark` - every declared pick is accepted and it is destroyed; a permanent the clause
// excludes is refused (D299). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARMAGGON_FUTURE_SHARK_SCRIPT } from './armaggonFutureShark';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Armaggon, Future Shark";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; target2: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Armaggon, Future Shark"], ["Grizzly Bears", "Vampire Nighthawk", "Forest"]],
    scripts: createRegistry([ARMAGGON_FUTURE_SHARK_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  const target = put(g, 'p2', "Grizzly Bears");
  const target2 = put(g, 'p2', "Vampire Nighthawk");
  const wrong = put(g, 'p2', "Forest");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, self, target, target2, wrong, life0 };
}

describe("Armaggon, Future Shark", () => {
  test("each of Grizzly Bears and Vampire Nighthawk is accepted and it is destroyed", () => {
    const { g, self, target, target2 } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }, { kind: 'card', id: target2 }] }));
    settle(g);
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[target2]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
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
