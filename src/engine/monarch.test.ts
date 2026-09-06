// D332 - THE MONARCH (CR 724): a card crowns its controller; the monarch draws
// a card at the beginning of their end step; a creature dealing combat damage
// to the monarch makes its controller the monarch.
import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registry';
import { THORN_OF_THE_BLACK_ROSE_SCRIPT } from './scripts/cards/thornOfTheBlackRose';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Thorn of the Black Rose enters for p1 on p1's third-turn main phase: "When this creature enters, you become the monarch." */
function crowned(): { g: Game; self: InstanceId; no: InstanceId; hand0: number; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [['Thorn of the Black Rose'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([THORN_OF_THE_BLACK_ROSE_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const self = put(g, 'p1', 'Thorn of the Black Rose', 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  expect(g.state.monarch).toBeNull();
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  expect(g.state.monarch).toBe('p1');
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const life0 = g.state.players.p1?.life ?? 0;
  return { g, self, no, hand0, life0 };
}

describe('D332 - the monarch', () => {
  test('the monarch draws a card at the beginning of their end step (CR 724.3)', () => {
    const { g, hand0 } = crowned();
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    // p1's end-step draw, and nothing else (p2's draw step is p2's).
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(g.state.monarch).toBe('p1');
  });

  test("the opponent's creature dealing combat damage to the monarch takes the crown (CR 724.5)", () => {
    const { g, no, life0 } = crowned();
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers' || s.turn.phase === 'postcombatMain', 40_000);
    if (g.state.priority.awaiting?.kind === 'declareBlockers') {
      must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [] }));
    }
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'postcombatMain', 40_000);
    expect(g.state.players.p1?.life).toBeLessThan(life0);
    expect(g.state.monarch).toBe('p2');
  });

  test('the new monarch draws at their own end step, the old one does not', () => {
    const { g, no } = crowned();
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers' || s.turn.phase === 'postcombatMain', 40_000);
    if (g.state.priority.awaiting?.kind === 'declareBlockers') {
      must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [] }));
    }
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'postcombatMain', 40_000);
    const p1 = (g.state.zones.hand.p1 ?? []).length;
    const p2 = (g.state.zones.hand.p2 ?? []).length;
    advanceUntil(g, (s) => s.turn.turnNumber === 5, 40_000);
    // p2's end step: p2 draws as the monarch; at the top of turn 5 (before p1's
    // own draw step) p1's hand is exactly what it was - the old monarch drew nothing.
    expect((g.state.zones.hand.p2 ?? []).length).toBe(p2 + 1);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(p1);
  });
});
