// `Infectious Host` — dying drains the chosen player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { INFECTIOUS_HOST_SCRIPT } from './infectiousHost';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HOST = 'Infectious Host';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[HOST], []],
    scripts: createRegistry([INFECTIOUS_HOST_SCRIPT]),
  });
  const host = put(g, 'p1', HOST);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: host,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Infectious Host', () => {
  test('dying makes the chosen player lose 2 life', () => {
    const g = answered();
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const g = answered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
