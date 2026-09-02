// `Fountain of Renewal` — 1 life at each of MY upkeeps, none at the
// opponent's; three mana and the Fountain buy a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FOUNTAIN_OF_RENEWAL_SCRIPT } from './fountainOfRenewal';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FOUNTAIN = 'Fountain of Renewal';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player),
    ).length;
}

function placed(): { g: Game; fountain: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [[FOUNTAIN], []],
    scripts: createRegistry([FOUNTAIN_OF_RENEWAL_SCRIPT]),
  });
  const fountain = put(g, 'p1', FOUNTAIN);
  settle(g);
  const life0 = g.state.players['p1']?.life ?? 0;
  return { g, fountain, life0 };
}

describe('Fountain of Renewal', () => {
  test("my next upkeep is 1 life; the opponent's upkeep in between is nothing", () => {
    const { g, life0 } = placed();
    // Turn 2 is the opponent's: through it, nothing.
    advanceUntil(g, (s) => s.turn.turnNumber >= 2 && s.turn.phase === 'precombatMain', 60_000);
    expect(g.state.players['p1']?.life).toBe(life0);
    // Turn 3 is mine again: the upkeep paid.
    advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.turn.phase === 'precombatMain', 60_000);
    expect(g.state.players['p1']?.life).toBe(life0 + 1);
  });

  test('{3}, sacrifice: draw a card', () => {
    const { g, fountain } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fountain, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[fountain]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = placed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
