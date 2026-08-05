// `Azure Mage` — no {T} in the cost, so no summoning sickness and TWICE in a
// turn with the mana (Ant Queen's repeatability, on a draw).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AZURE_MAGE_SCRIPT } from './azureMage';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGE = 'Azure Mage';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; mage: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGE], []],
    scripts: createRegistry([AZURE_MAGE_SCRIPT]),
  });
  const mage = put(g, 'p1', MAGE);
  settle(g);
  return { g, mage };
}

function fund(g: Game): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
        ),
    ).length;
}

describe('Azure Mage', () => {
  test('draws a card, and goes AGAIN the same turn — no tap in the cost', () => {
    const { g, mage } = game();
    const logAt = g.log.length;
    fund(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    fund(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.cards[mage]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, mage } = game();
    fund(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
