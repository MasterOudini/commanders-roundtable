// `Reclaim` — the graveyard card goes on top, and the next draw is it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RECLAIM_SCRIPT } from './reclaim';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reclaimed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Reclaim', 'Grizzly Bears'], []],
    scripts: createRegistry([RECLAIM_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  settle(g);
  const spell = put(g, 'p1', 'Reclaim', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears };
}

describe('Reclaim', () => {
  test('the card sits on top of my library', () => {
    const { g, bears } = reclaimed();
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(bears);
  });

  test('replays to the same hash', () => {
    const { g } = reclaimed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
