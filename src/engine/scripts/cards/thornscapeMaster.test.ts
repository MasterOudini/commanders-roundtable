// `Thornscape Master` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { THORNSCAPE_MASTER_SCRIPT } from './thornscapeMaster';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Thornscape Master";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([THORNSCAPE_MASTER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Thornscape Master"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([THORNSCAPE_MASTER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
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
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Thornscape Master", () => {
  test("{R}{R}, {T}: it deals 2 damage to the declared creature", () => {
    const { g, self, no } = armed(0);
    expect(g.state.cards[no]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test("{W}{W}, {T}: the vocabulary resolves \"Target creature gains protection from the color of your choice until end of turn.\"", () => {
    const { g, self, no } = armed(1);
    expect(g.log.some((x) => x.body.t === "AwaitingSet" && x.body.awaiting?.kind === "chooseColor" && x.body.awaiting.resolving === true), "the colour asked as it resolves").toBe(true);
    { const aw = g.state.priority.awaiting; if (aw?.kind === "chooseColor" && aw.resolving === true) { must(g.submit({ t: "AnswerChooseColor", player: aw.player, color: "R" })); settle(g); } }
    expect(pt(g, no)).toEqual([5, 2]);
    expect(g.log.some((x) => x.body.t === "PtModifiedUntilEndOfTurn" && x.body.card === no && (x.body.protection?.colors ?? []).length > 0), "the protection gained").toBe(true);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
