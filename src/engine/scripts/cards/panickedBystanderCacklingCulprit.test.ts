// `Panicked Bystander // Cackling Culprit` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { PANICKED_BYSTANDER_CACKLING_CULPRIT_SCRIPT } from './panickedBystanderCacklingCulprit';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Panicked Bystander // Cackling Culprit";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([PANICKED_BYSTANDER_CACKLING_CULPRIT_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([PANICKED_BYSTANDER_CACKLING_CULPRIT_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

// D578 - the card turned to the face the fired ability belongs to (the manual flip).
function faceUp(g: Game, self: InstanceId, face: number): void {
  const c = g.state.cards[self];
  if (!c || c.zone.kind !== 'battlefield' || (c.faceIndex ?? 0) === face) return;
  must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Panicked Bystander // Cackling Culprit", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([PANICKED_BYSTANDER_CACKLING_CULPRIT_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![null,null,null,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  faceUp(g, self, [0,0,0,1][which] ?? 0);
  if (which === 2) {
    { advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
      const fired0 = g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length;
      advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'end', 60000);
      settle(g);
          if (g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length !== fired0) throw new Error('the trigger fired with its condition unmet');
      advanceUntil(g, (s) => s.turn.turnNumber === 7 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
    }
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 3 }));
      settle(g);
  }
  const life0 = g.state.players.p1?.life ?? 0;
  const energy0 = g.state.players.p1?.energy ?? 0;
  let hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    const bears = put(g, 'p1', "Grizzly Bears");
    hand0 = (g.state.zones.hand.p1 ?? []).length;
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    }
  if (which === 2) {
    advanceUntil(g, (s) => s.turn.turnNumber === 7 && s.turn.step === 'end', 60000);
    settle(g);
    }
  if (which === 3) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Panicked Bystander // Cackling Culprit", () => {
  test("Whenever this creature or another creature you control dies: 1 life is gained [dies]", () => {
    const { g, life0 } = armed(0);
    expect(g.state.players.p1?.life).toBe(life0 + 1);
  });

  test("Whenever this creature or another creature you control dies: 1 life is gained [anotherCreatureDies]", () => {
    const { g, life0 } = armed(1);
    expect(g.state.players.p1?.life).toBe(life0 + 1);
  });

  test("At the beginning of your end step: the vocabulary resolves \"Transform this creature.\"", () => {
    const { g, self } = armed(2);
    expect(g.state.cards[self]?.faceIndex ?? 0, 'transformed').toBe(1);
  });

  test("{1}{B}: it gains deathtouch until end of turn", () => {
    const { g, self } = armed(3);
    expect(pt(g, self)).toEqual([3, 5]);
    expect(kw(g, self).has("deathtouch")).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
