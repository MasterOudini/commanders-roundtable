// `Font of Return` - every declared pick is accepted and it returns to hand; a permanent the clause
// excludes is refused (D299). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FONT_OF_RETURN_SCRIPT } from './fontOfReturn';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Font of Return";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; target2: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Font of Return", "Grizzly Bears", "Vampire Nighthawk", "Lightning Bolt"], ["Grizzly Bears"]],
    scripts: createRegistry([FONT_OF_RETURN_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p1', "Grizzly Bears", 'graveyard');
  const target2 = put(g, 'p1', "Vampire Nighthawk", 'graveyard');
  const wrong = put(g, 'p1', "Lightning Bolt", 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, self, target, target2, wrong, life0 };
}

describe("Font of Return", () => {
  test("each of Grizzly Bears and Vampire Nighthawk is accepted and it returns to hand", () => {
    const { g, self, target, target2 } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }, { kind: 'card', id: target2 }] }));
    settle(g);
    expect(g.state.cards[target]?.zone.kind).toBe('hand');
    expect(g.state.cards[target2]?.zone.kind).toBe('hand');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test("Lightning Bolt is refused (D299)", () => {
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
