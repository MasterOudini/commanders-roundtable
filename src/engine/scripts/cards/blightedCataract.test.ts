// `Blighted Cataract` — the land-body sacrifice-draw; a land needs no
// summoning-sickness wait.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLIGHTED_CATARACT_SCRIPT } from './blightedCataract';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CATARACT = 'Blighted Cataract';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; cataract: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CATARACT], []],
    scripts: createRegistry([BLIGHTED_CATARACT_SCRIPT]),
  });
  const cataract = put(g, 'p1', CATARACT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  return { g, cataract };
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log.slice(from).reduce(
    (n, e) =>
      e.body.t === 'CardsMoved'
        ? n +
          e.body.moves.filter(
            (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
          ).length
        : n,
    0,
  );
}

describe('Blighted Cataract', () => {
  test('draws two, with the Cataract spent as part of the cost', () => {
    const { g, cataract } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cataract, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.cards[cataract]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, cataract } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cataract, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
