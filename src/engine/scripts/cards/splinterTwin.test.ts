// `Splinter Twin` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SPLINTER_TWIN_SCRIPT } from './splinterTwin';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { legalActions } from '../../legal';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Splinter Twin";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; bearsB: InstanceId; tok0: readonly InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokensMade(g: Game, before: readonly InstanceId[]): InstanceId[] {
  return Object.values(g.state.cards).filter((c) => c.isToken === true && c.zone.kind === 'battlefield' && c.controller === 'p1' && !before.includes(c.id)).map((c) => c.id);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Splinter Twin", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SPLINTER_TWIN_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const bearsB = put(g, 'p1', "Grizzly Bears");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  if (![true,true][which]) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const tok0 = Object.values(g.state.cards).filter((c) => c.isToken === true && c.zone.kind === 'battlefield' && c.controller === 'p1').map((c) => c.id);
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bearsB], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
    { const grantOffer = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((x) => x.t === 'ActivateAbility' && x.card === bearsB && x.grantRef !== undefined);
      if (!grantOffer || grantOffer.t !== 'ActivateAbility' || grantOffer.grantRef === undefined) throw new Error('no granted offer on the host');
      must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bearsB, abilityIndex: grantOffer.abilityIndex, grantRef: grantOffer.grantRef }));
    }
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, bearsB, tok0 };
}

describe("Splinter Twin", () => {
  test("Enchanted creature has \"{T}: the creature it is attached to reads it", () => {
    const { g, self, bearsB } = armed(0);
    expect(g.state.cards[self]?.attachedTo).toBe(bearsB);
  });

  test("Enchanted creature has \"{T}: the vocabulary resolves \"Create a token that's a copy of this creature, except it has haste. Exile that token at the beginning of the next end step.\"", () => {
    const { g, board0, bearsB, tok0 } = armed(1);
    const made = tokensMade(g, tok0);
    expect(made, 'the tokens the fire made').toHaveLength(1);
    expect(onBoard(g)).toBe(board0 + 1 + 1);
    expect(g.state.delayedTriggers.length, 'the payload is armed, not run').toBe(1);
    { const boardD = onBoard(g);
      advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === "end", 40_000);
      settle(g);
      expect(onBoard(g), "the board after the step").toBe(boardD + -1);
      for (const id of made) expect(g.state.cards[id]?.zone.kind, "exileObj at the step").not.toBe('battlefield');
    }
    expect(g.state.delayedTriggers.length, 'every entry fired').toBe(0);
    expect(g.state.cards[bearsB]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
