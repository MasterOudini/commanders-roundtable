// `Goblin Settler` — entering asks for a land and destroys it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_SETTLER_SCRIPT } from './goblinSettler';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SETTLER = 'Goblin Settler';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SETTLER], [MOUNTAIN]],
    scripts: createRegistry([GOBLIN_SETTLER_SCRIPT]),
  });
  const mountain = put(g, 'p2', MOUNTAIN);
  settle(g);
  return { g, mountain };
}

describe('Goblin Settler', () => {
  test('entering destroys the chosen land', () => {
    const { g, mountain } = board();
    put(g, 'p1', SETTLER);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mountain }] }));
    settle(g);
    expect(g.state.cards[mountain]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, mountain } = board();
    put(g, 'p1', SETTLER);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mountain }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
