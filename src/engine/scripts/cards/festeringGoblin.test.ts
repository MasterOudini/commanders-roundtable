// `Festering Goblin` — the dies-trigger asks, and the -1/-1 kills a 1/1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FESTERING_GOBLIN_SCRIPT } from './festeringGoblin';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GOBLIN = 'Festering Goblin';
const SMALL = 'Devout Monk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GOBLIN], [SMALL]],
    scripts: createRegistry([FESTERING_GOBLIN_SCRIPT]),
  });
  const goblin = put(g, 'p1', GOBLIN);
  const theirs = put(g, 'p2', SMALL);
  settle(g);
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: goblin, to: { kind: 'graveyard', player: 'p1' } }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, theirs };
}

describe('Festering Goblin', () => {
  test('the -1/-1 kills a 1/1 through the SBA', () => {
    const { g, theirs } = died();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, theirs } = died();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
