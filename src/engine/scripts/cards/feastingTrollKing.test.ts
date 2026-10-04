// `Feasting Troll King` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { FEASTING_TROLL_KING_SCRIPT } from './feastingTrollKing';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';
import { TOKEN_TABLE } from '../../../data/tokenTable';

const CARD = "Feasting Troll King";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; condRefused: boolean; fodder0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Feasting Troll King"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([FEASTING_TROLL_KING_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: TOKEN_TABLE["Food|/||Artifact|"]?.printingId ?? '', count: 3 }));
  const made0 = Object.values(g.state.cards).filter((c) => c.isToken && c.controller === 'p1').map((c) => c.id);
  if (made0.length < 3) throw new Error('no token made');
  const fodder0 = made0.slice(0, 3);
  settle(g);
  const self = put(g, 'p1', CARD, [1].includes(which) ? 'graveyard' : 'graveyard');
  settle(g);
  if (![true,true][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  let condRefused = false;
  if (which === 1) {
    // D371 - the opponent's second turn: not your turn, not your upkeep - refused for the condition alone.
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'upkeep' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    { const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0.slice(0, 3) }); condRefused = !early.ok && early.reason === 'timingRestriction'; }
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (which === 0) {
    { const fired0 = g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length;
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
      settle(g);
      if (g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length !== fired0) throw new Error('the trigger fired with its condition unmet');
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'hand', player: 'p1' } }));
      settle(g); }
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
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self,  }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0.slice(0, 3) }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, condRefused, fodder0 };
}

describe("Feasting Troll King", () => {
  test("When this creature enters: 3 tokens made", () => {
    const { g, board0 } = armed(0);
    expect(onBoard(g)).toBe(board0 + 3 + 1);
  });

  test("Sacrifice three Foods: it returns from the graveyard to the battlefield - refused unless during your turn", () => {
    const { g, self, condRefused, fodder0 } = armed(1);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.controller).toBe('p1');
    expect(g.state.cards[self]?.tapped).toBe(false);
    expect(condRefused).toBe(true);
    for (const f of fodder0.slice(0, 3)) expect(g.state.cards[f]?.zone.kind ?? 'gone').not.toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
