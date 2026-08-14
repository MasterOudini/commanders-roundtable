// `Goblin Gardener` — dying asks for a land and destroys it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_GARDENER_SCRIPT } from './goblinGardener';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GARDENER = 'Goblin Gardener';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; gardener: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GARDENER], [MOUNTAIN]],
    scripts: createRegistry([GOBLIN_GARDENER_SCRIPT]),
  });
  const gardener = put(g, 'p1', GARDENER);
  const mountain = put(g, 'p2', MOUNTAIN);
  settle(g);
  return { g, gardener, mountain };
}

describe('Goblin Gardener', () => {
  test('dying destroys the chosen land', () => {
    const { g, gardener, mountain } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: gardener, to: { kind: 'graveyard', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mountain }] }));
    settle(g);
    expect(g.state.cards[mountain]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, gardener, mountain } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: gardener, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mountain }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
