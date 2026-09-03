// `Earthcraft` - the named target is accepted and it untaps; a permanent the adjective excludes
// is refused (D294). Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EARTHCRAFT_SCRIPT } from './earthcraft';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Earthcraft";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; wrong: InstanceId; life0: number; tapper: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Earthcraft", "Forest", "Quicksand", "Grizzly Bears"], ["Grizzly Bears"]],
    scripts: createRegistry([EARTHCRAFT_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p1', "Forest");
  const wrong = put(g, 'p1', "Quicksand");
  const tapper = put(g, 'p1', "Grizzly Bears");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [target], tapped: true }));
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, tap: [tapper] }));
  return { g, self, target, wrong, life0, tapper };
}

describe("Earthcraft", () => {
  test("Forest (tapped) is a legal target and it untaps", () => {
    const { g, target, tapper } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(g.state.cards[target]?.tapped).toBe(false);
    expect(g.state.cards[tapper]?.tapped).toBe(true);
  });

  test("Quicksand (untapped) is refused (D294)", () => {
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
