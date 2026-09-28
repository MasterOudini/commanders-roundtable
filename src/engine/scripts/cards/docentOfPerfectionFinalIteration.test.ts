// `Docent of Perfection // Final Iteration` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { DOCENT_OF_PERFECTION_FINAL_ITERATION_SCRIPT } from './docentOfPerfectionFinalIteration';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Docent of Perfection // Final Iteration";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; yes: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([DOCENT_OF_PERFECTION_FINAL_ITERATION_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([DOCENT_OF_PERFECTION_FINAL_ITERATION_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
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
    decks: [["Docent of Perfection // Final Iteration", "Fugitive Wizard", "Pyretic Ritual", "Fugitive Wizard", "Fugitive Wizard", "Fugitive Wizard"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([DOCENT_OF_PERFECTION_FINAL_ITERATION_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Fugitive Wizard");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  faceUp(g, self, [0,1,1][which] ?? 0);
  const ritual = put(g, 'p1', "Pyretic Ritual", 'hand');
  if (which === 0) {
    // the payload's gate: you control 3 or more Wizard
    put(g, 'p1', "Fugitive Wizard");
    put(g, 'p1', "Fugitive Wizard");
    put(g, 'p1', "Fugitive Wizard");
      settle(g);
  }
  const life0 = g.state.players.p1?.life ?? 0;
  const energy0 = g.state.players.p1?.energy ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
    settle(g);
    }
  if (which === 1) {
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, yes };
}

describe("Docent of Perfection // Final Iteration", () => {
  test("Whenever you cast an instant or sorcery spell: the vocabulary resolves \"Create a 1/1 blue Human Wizard creature token. Then if you control three or more Wizards, transform this creature.\"", () => {
    const { g, self, board0 } = armed(0);
    expect(g.state.cards[self]?.faceIndex ?? 0, 'transformed').toBe(1);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test("Wizards you control get +2/+1 and have flying.: only the Wizard reads it", () => {
    const { g, no, yes } = armed(1);
    expect(pt(g, yes)).toEqual([3, 2]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("flying")).toBe(true);
    expect(kw(g, no).has("flying")).toBe(false);
  });

  test("Whenever you cast an instant or sorcery spell: 1 token made", () => {
    const { g, board0 } = armed(2);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
