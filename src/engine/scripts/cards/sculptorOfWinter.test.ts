// `Sculptor of Winter` - the named target is accepted and it untaps; a permanent the adjective excludes
// is refused (D294). Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCULPTOR_OF_WINTER_SCRIPT } from './sculptorOfWinter';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Sculptor of Winter";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Sculptor of Winter", "Snow-Covered Forest", "Forest"], ["Grizzly Bears"]],
    scripts: createRegistry([SCULPTOR_OF_WINTER_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p1', "Snow-Covered Forest");
  const wrong = put(g, 'p1', "Forest");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [target], tapped: true }));
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, self, target, wrong, life0 };
}

describe("Sculptor of Winter", () => {
  test("Snow-Covered Forest (tapped) is a legal target and it untaps", () => {
    const { g, self, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(g.state.cards[target]?.tapped).toBe(false);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test("Forest (untapped) is refused (D294)", () => {
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
