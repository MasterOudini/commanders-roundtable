// `Liliana's Specter` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { LILIANAS_SPECTER_SCRIPT } from './lilianasSpecter';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Liliana's Specter";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Liliana's Specter"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([LILIANAS_SPECTER_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0 };
}

describe("Liliana's Specter", () => {
  test("When this creature enters: the vocabulary resolves \"Each opponent discards a card.\"", () => {
    const { g } = armed(0);
    let qdL1 = 0;
    for (let qi = 0; qi < 4; qi++) {
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null), 20_000);
      const qa = g.state.priority.awaiting;
      if (qa?.kind !== 'chooseFromZone' || qa.zone !== 'hand') break;
      must(g.submit({ t: 'AnswerChooseFromZone', player: qa.player, cards: (g.state.zones.hand[qa.player] ?? []).slice(0, qa.count) }));
    }
    settle(g);
    expect(g.state.pendingAsks).toBeNull();
    { const qb = [...g.log].reverse().find((x) => x.body.t === 'CardsMoved' && x.body.moves.some((m) => m.reason === 'discard'));
      expect(qb, 'the queued discard landed').toBeDefined();
      const qm = qb && qb.body.t === 'CardsMoved' ? qb.body.moves : [];
      for (const m of qm) expect(g.state.cards[m.card]?.zone.kind).toBe('graveyard');
      expect(qm.some((m) => m.from.kind === 'hand' && m.from.player === 'p2'), 'p2 discarded').toBe(true);
      qdL1 = qm.filter((m) => m.from.kind === 'hand' && m.from.player === 'p1').length;
    }
    expect(qdL1, 'p1 was not in the scope').toBe(0);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
