// `Mobilization` - the grant reaches the permanent its scope names and not the other;
// it ends when the source leaves; replay equal (D300). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOBILIZATION_SCRIPT } from './mobilization';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Mobilization";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}


function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([MOBILIZATION_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBattlefield(g: Game, player: 'p1' | 'p2'): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === player).length;
}

function board(): { g: Game; self: InstanceId; yes: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Mobilization"], ["Straw Soldiers", "Coral Eel"]],
    scripts: createRegistry([MOBILIZATION_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p2', "Straw Soldiers");
  const no = put(g, 'p2', "Coral Eel");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, yes, no };
}

describe("Mobilization", () => {
  test("Straw Soldiers is reached, Coral Eel is not", () => {
    const { g, yes, no } = board();
    expect(kw(g, yes).has("vigilance")).toBe(true);
    expect(kw(g, no).has("vigilance")).toBe(false);
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, yes } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(kw(g, yes).has("vigilance")).toBe(false);
  });

  test("the activation creates a token", () => {
    const { g, self } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const before = onBattlefield(g, 'p1');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    expect(onBattlefield(g, 'p1')).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
