// `Korlessa, Scale Singer` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { KORLESSA_SCALE_SINGER_SCRIPT } from './korlessaScaleSinger';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import { seesTop } from '../../topOfLibrary';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Korlessa, Scale Singer";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Korlessa, Scale Singer", "Dragon Hatchling", "Dragon Hatchling"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([KORLESSA_SCALE_SINGER_SCRIPT]),
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
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    const topSpell = (Object.keys(g.state.cards) as InstanceId[]).find((id) => nameOf(g, id) === "Dragon Hatchling" && (g.state.cards[id]?.zone.kind === 'library' || g.state.cards[id]?.zone.kind === 'hand') && g.state.cards[id]?.zone.player === 'p1');
    if (!topSpell) throw new Error("Dragon Hatchling is dealt for the top");
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: topSpell, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: topSpell }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Korlessa, Scale Singer", () => {
  test("You may look at the top card of your library any time.: its owner sees the top card of the library", () => {
    const { g } = armed(0);
    expect(seesTop(g.state, g.deps.oracle, g.deps.scripts, 'p1', 'p1'), 'its owner sees the top card').toBe(true);
    expect(seesTop(g.state, g.deps.oracle, g.deps.scripts, 'p2', 'p1'), "a look is its owner alone").toBe(false);
  });

  test("You may cast Dragon spells from the top of your library.: a Dragon spell is cast from the top", () => {
    const { g } = armed(1);
    expect(g.log.some((ev) => ev.body.t === 'CardsMoved' && ev.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'stack' && nameOf(g, m.card) === "Dragon Hatchling")), 'a spell cast from the top').toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
