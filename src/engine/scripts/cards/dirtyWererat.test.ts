// `Dirty Wererat` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { DIRTY_WERERAT_SCRIPT } from './dirtyWererat';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Dirty Wererat";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; refused: boolean; disc0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([DIRTY_WERERAT_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Dirty Wererat", "Grizzly Bears", "Lightning Bolt"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([DIRTY_WERERAT_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const disc0 = [put(g, 'p1', "Grizzly Bears", 'hand')];
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  let refused = false;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, discard: disc0 }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: self }] }));
    settle(g);
    }
  if (which === 1) {
    for (let i = 0; i < 7; i++) {
      const top = (g.state.zones.library.p1 ?? [])[0] as InstanceId;
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: top, to: { kind: 'graveyard', player: 'p1' } }));
    }
    settle(g);
    }
  if (which === 2) {
    for (let i = 0; i < 7; i++) {
      const top = (g.state.zones.library.p1 ?? [])[0] as InstanceId;
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: top, to: { kind: 'graveyard', player: 'p1' } }));
    }
    settle(g);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    refused = !g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: self, attacker: no }] }).ok;
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, refused, disc0 };
}

describe("Dirty Wererat", () => {
  test("{B}, Discard a card: it regenerates from the Bolt", () => {
    const { g, self, disc0 } = armed(0);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(g.state.cards[self]?.damage).toBe(0);
    expect(g.state.regenerationShields[self] ?? 0).toBe(0);
    for (const c of disc0) expect(g.state.cards[c]?.zone.kind).toBe('graveyard');
  });

  test("Threshold — As long as there are seven or more cards in your graveyard, this creature gets +2/+2 and can't block.: with seven cards in the graveyard it reads the pump", () => {
    const { g, self } = armed(1);
    expect(pt(g, self)).toEqual([4, 5]);
  });

  test("Threshold — As long as there are seven or more cards in your graveyard, this creature gets +2/+2 and can't block.: the block is refused", () => {
    const { refused } = armed(2);
    expect(refused).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
