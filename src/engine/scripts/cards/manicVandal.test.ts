// `Manic Vandal` — destroys the artifact; an indestructible one survives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MANIC_VANDAL_SCRIPT } from './manicVandal';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VANDAL = 'Manic Vandal';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(artifact: string): { g: Game; relic: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VANDAL], [artifact]],
    scripts: createRegistry([MANIC_VANDAL_SCRIPT]),
  });
  const relic = put(g, 'p2', artifact);
  settle(g);
  const vandal = put(g, 'p1', VANDAL, 'graveyard');
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: vandal,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: relic }] }));
  settle(g);
  return { g, relic };
}

describe('Manic Vandal', () => {
  test('destroys the targeted artifact', () => {
    const { g, relic } = board('Sol Ring');
    expect(g.state.cards[relic]?.zone.kind).toBe('graveyard');
  });

  test('an indestructible artifact survives (Darksteel Citadel)', () => {
    const { g, relic } = board('Darksteel Citadel');
    expect(g.state.cards[relic]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = board('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
