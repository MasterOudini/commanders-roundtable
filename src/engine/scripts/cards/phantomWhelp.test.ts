// `Phantom Whelp` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { PHANTOM_WHELP_SCRIPT } from './phantomWhelp';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Phantom Whelp";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; gift2: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Phantom Whelp"], ["Cyclops of One-Eyed Pass", "Thraben Standard Bearer"]],
    scripts: createRegistry([PHANTOM_WHELP_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const gift2 = put(g, 'p2', "Thraben Standard Bearer");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
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
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: gift2, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: self, attacker: gift2 }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, gift2 };
}

describe("Phantom Whelp", () => {
  test("When this creature attacks or blocks: the vocabulary resolves \"Return ~ to its owner's hand at end of combat.\" [attacks]", () => {
    const { g, self } = armed(0);
    expect(g.state.delayedTriggers.length, 'the payload is armed, not run').toBe(1);
    { const handD = (g.state.zones.hand.p1 ?? []).length; const boardD = onBoard(g);
      advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === "endCombat", 40_000);
      settle(g);
      expect((g.state.zones.hand.p1 ?? []).length, "the hand after the step").toBe(handD + 1);
      expect(onBoard(g), "the board after the step").toBe(boardD + -1);
      expect(g.state.cards[self]?.zone.kind, 'bounced at the step').toBe('hand');
    }
    expect(g.state.delayedTriggers.length, 'every entry fired').toBe(0);
  });

  test("When this creature attacks or blocks: the vocabulary resolves \"Return ~ to its owner's hand at end of combat.\" [blocks]", () => {
    const { g, self } = armed(1);
    expect(g.state.delayedTriggers.length, 'the payload is armed, not run').toBe(1);
    { const handD = (g.state.zones.hand.p1 ?? []).length; const boardD = onBoard(g);
      advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === "endCombat", 40_000);
      settle(g);
      expect((g.state.zones.hand.p1 ?? []).length, "the hand after the step").toBe(handD + 1);
      expect(onBoard(g), "the board after the step").toBe(boardD + -1);
      expect(g.state.cards[self]?.zone.kind, 'bounced at the step').toBe('hand');
    }
    expect(g.state.delayedTriggers.length, 'every entry fired').toBe(0);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
