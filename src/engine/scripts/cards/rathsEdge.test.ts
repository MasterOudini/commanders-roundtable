// `Rath's Edge` — a land goes in, one point comes out, at either kind of
// target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RATHS_EDGE_SCRIPT } from './rathsEdge';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function edged(): { g: Game; edge: InstanceId; fodder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Rath's Edge"], []],
    scripts: createRegistry([RATHS_EDGE_SCRIPT]),
  });
  const edge = put(g, 'p1', "Rath's Edge");
  const fodder = put(g, 'p1', 'Forest');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, edge, fodder };
}

describe('Raths Edge', () => {
  test('sacrifices the Forest and pings the player', () => {
    const { g, edge, fodder } = edged();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: edge,
        abilityIndex: 1,
        sacrifice: fodder,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[edge]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g, edge, fodder } = edged();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: edge,
        abilityIndex: 1,
        sacrifice: fodder,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
