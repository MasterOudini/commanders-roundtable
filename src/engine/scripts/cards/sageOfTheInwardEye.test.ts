// `Sage of the Inward Eye` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAGE_OF_THE_INWARD_EYE_SCRIPT } from './sageOfTheInwardEye';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Sage of the Inward Eye";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; yes: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([SAGE_OF_THE_INWARD_EYE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([SAGE_OF_THE_INWARD_EYE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Sage of the Inward Eye", "Coral Eel", "Pyretic Ritual"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SAGE_OF_THE_INWARD_EYE_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  if (which === 0) {
    const ritual = put(g, 'p1', "Pyretic Ritual", 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, yes };
}

describe("Sage of the Inward Eye", () => {
  test("Whenever you cast a noncreature spell: its controller's creatures gain lifelink until end of turn", () => {
    const { g, no, yes } = armed(0);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("lifelink")).toBe(true);
    expect(kw(g, no).has("lifelink")).toBe(false);
  });

  test('the pump ends at cleanup', () => {
    const { g, yes } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(kw(g, yes).has("lifelink")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
