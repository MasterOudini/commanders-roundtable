// `Fire Snake` — the dies-trigger burns a land down.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FIRE_SNAKE_SCRIPT } from './fireSnake';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SNAKE = 'Fire Snake';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SNAKE], [MOUNTAIN]],
    scripts: createRegistry([FIRE_SNAKE_SCRIPT]),
  });
  const snake = put(g, 'p1', SNAKE);
  const land = put(g, 'p2', MOUNTAIN);
  settle(g);
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: snake, to: { kind: 'graveyard', player: 'p1' } }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, land };
}

describe('Fire Snake', () => {
  test('destroys the target land', () => {
    const { g, land } = died();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, land } = died();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
