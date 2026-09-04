// `Argothian Elder` - every declared pick is accepted and it untaps; a permanent the clause
// excludes is refused beside a legal one (D299). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARGOTHIAN_ELDER_SCRIPT } from './argothianElder';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Argothian Elder";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; target2: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Argothian Elder", "Forest", "Quicksand", "Grizzly Bears"], ["Grizzly Bears"]],
    scripts: createRegistry([ARGOTHIAN_ELDER_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p1', "Forest");
  const target2 = put(g, 'p1', "Quicksand");
  const wrong = put(g, 'p1', "Grizzly Bears");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [target], tapped: true }));
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [target2], tapped: true }));
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, self, target, target2, wrong, life0 };
}

describe("Argothian Elder", () => {
  test("each of Forest and Quicksand is accepted and it untaps", () => {
    const { g, self, target, target2 } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }, { kind: 'card', id: target2 }] }));
    settle(g);
    expect(g.state.cards[target]?.tapped).toBe(false);
    expect(g.state.cards[target2]?.tapped).toBe(false);
    expect(g.state.cards[self]?.tapped).toBe(true);
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
