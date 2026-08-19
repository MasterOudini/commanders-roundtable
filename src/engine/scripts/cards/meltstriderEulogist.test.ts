// `Meltstrider Eulogist` — a countered creature dying draws; a bare one does
// not. The counter is read off the BEFORE state (looksBack).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MELTSTRIDER_EULOGIST_SCRIPT } from './meltstriderEulogist';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const EULOGIST = 'Meltstrider Eulogist';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
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

function board(): { g: Game; bears: InstanceId; lion: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[EULOGIST, 'Grizzly Bears', 'Silvercoat Lion'], []],
    scripts: createRegistry([MELTSTRIDER_EULOGIST_SCRIPT]),
  });
  put(g, 'p1', EULOGIST);
  const bears = put(g, 'p1', 'Grizzly Bears');
  const lion = put(g, 'p1', 'Silvercoat Lion');
  settle(g);
  must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
  return { g, bears, lion };
}

describe('Meltstrider Eulogist', () => {
  test('a countered creature dying draws; a counterless one does not', () => {
    const { g, bears, lion } = board();
    let logAt = g.log.length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: lion,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
    logAt = g.log.length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, bears } = board();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
