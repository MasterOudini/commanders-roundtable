// `Malcator's Watcher` — dying draws a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MALCATORS_WATCHER_SCRIPT } from './malcatorsWatcher';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WATCHER = "Malcator's Watcher";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [[WATCHER], []],
    scripts: createRegistry([MALCATORS_WATCHER_SCRIPT]),
  });
  const watcher = put(g, 'p1', WATCHER);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: watcher,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe("Malcator's Watcher", () => {
  test('dying draws its controller a card', () => {
    const g = died();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'CardsMoved' &&
          e.body.moves.some(
            (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === 'p1',
          ),
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = died();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
