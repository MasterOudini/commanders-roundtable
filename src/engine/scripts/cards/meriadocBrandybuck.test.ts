// `Meriadoc Brandybuck` — a Halfling attacking a PLAYER pays a Food; the
// same Halfling attacking a planeswalker pays nothing (the DefenderRef
// filter, proven from both sides).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MERIADOC_BRANDYBUCK_SCRIPT } from './meriadocBrandybuck';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MERIADOC = 'Meriadoc Brandybuck';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function food(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food').length;
}

describe('Meriadoc Brandybuck', () => {
  test('attacking a player pays a Food token', () => {
    const g = startedGame({
      players: 2,
      decks: [[MERIADOC], []],
      scripts: createRegistry([MERIADOC_BRANDYBUCK_SCRIPT]),
    });
    const merry = put(g, 'p1', MERIADOC);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: merry, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    expect(food(g)).toBe(1);
  });

  test('attacking a PLANESWALKER pays nothing — the defender filter', () => {
    const g = startedGame({
      players: 2,
      decks: [[MERIADOC], ['Grist, the Hunger Tide']],
      scripts: createRegistry([MERIADOC_BRANDYBUCK_SCRIPT]),
    });
    const merry = put(g, 'p1', MERIADOC);
    const grist = put(g, 'p2', 'Grist, the Hunger Tide');
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: merry, defender: { kind: 'permanent', id: grist } }],
      }),
    );
    settle(g);
    expect(food(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[MERIADOC], []],
      scripts: createRegistry([MERIADOC_BRANDYBUCK_SCRIPT]),
    });
    const merry = put(g, 'p1', MERIADOC);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: merry, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
