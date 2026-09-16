// `Mystic Might` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { MYSTIC_MIGHT_SCRIPT } from './mysticMight';
import { advanceUntil as walkUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import { legalActions } from '../../legal';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';
import type { GameState } from '../../types/state';

const CARD = "Mystic Might";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; bearsB: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
// D439 - the card's own cumulative upkeep is PAID at every upkeep the walk crosses (the harness's answer declines,
// which sacrifices the card under test); the lands are staged at arming.
function advanceUntil(g: Game, done: (s: GameState) => boolean, maxSteps = 4000): void {
  for (let i = 0; i < 40; i++) {
    walkUntil(g, (s) => done(s) || (s.priority.awaiting?.kind === 'payMana' && / - (?:echo|cumulative upkeep) /.test(s.priority.awaiting.label)), maxSteps);
    const a = g.state.priority.awaiting;
    if (done(g.state) || a?.kind !== 'payMana') return;
    must(g.submit({ t: 'AnswerPayMana', player: a.player, pay: true }));
  }
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([MYSTIC_MIGHT_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Mystic Might", "Forest", "Forest", "Island", "Forest", "Island", "Forest", "Island"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([MYSTIC_MIGHT_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  put(g, 'p1', "Forest");
  put(g, 'p1', "Island");
  put(g, 'p1', "Forest");
  put(g, 'p1', "Island");
  put(g, 'p1', "Forest");
  put(g, 'p1', "Island");
  const bearsB = put(g, 'p1', "Forest");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  if (![true,true][which]) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bearsB], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
    { const grantOffer = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((x) => x.t === 'ActivateAbility' && x.card === bearsB && x.grantRef !== undefined);
      if (!grantOffer || grantOffer.t !== 'ActivateAbility' || grantOffer.grantRef === undefined) throw new Error('no granted offer on the host');
      must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bearsB, abilityIndex: grantOffer.abilityIndex, grantRef: grantOffer.grantRef }));
    }
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, bearsB };
}

describe("Mystic Might", () => {
  test("Enchanted land has \"{T}: the creature it is attached to reads it", () => {
    const { g, self, bearsB } = armed(0);
    expect(g.state.cards[self]?.attachedTo).toBe(bearsB);
  });

  test("Enchanted land has \"{T}: the vocabulary resolves \"Target creature gets +2/+2 until end of turn.\"", () => {
    const { g, no, bearsB } = armed(1);
    expect(pt(g, no)).toEqual([7, 4]);
    expect(g.state.cards[bearsB]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
