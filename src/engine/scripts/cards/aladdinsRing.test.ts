// `Aladdin's Ring` — the first script damage: 4 to any target, marked on a
// creature (the SBA kills), taken off a player's life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ALADDINS_RING_SCRIPT } from './aladdinsRing';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const RING = "Aladdin's Ring";

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[RING], ['Serra Angel']],
    scripts: createRegistry([ALADDINS_RING_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fund(g: Game): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
}

describe("Aladdin's Ring", () => {
  test('4 damage to a player, through the real activation', () => {
    const g = game();
    const ring = put(g, 'p1', RING);
    settle(g);
    fund(g);
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: ring,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players['p2']?.life).toBe(36);
    expect(g.state.cards[ring]?.tapped).toBe(true);
  });

  test('4 damage marks a 4/4 dead through the SBA, not through the script', () => {
    const g = game();
    const ring = put(g, 'p1', RING);
    const angel = put(g, 'p2', 'Serra Angel'); // 4/4 flier
    settle(g);
    fund(g);
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: ring,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: angel }],
      }),
    );
    settle(g);
    expect(g.state.cards[angel]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const g = game();
    const ring = put(g, 'p1', RING);
    settle(g);
    fund(g);
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: ring,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
