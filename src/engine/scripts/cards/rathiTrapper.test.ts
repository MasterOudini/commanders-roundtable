// `Rathi Trapper` — a black pip and a tap turn the target sideways.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RATHI_TRAPPER_SCRIPT } from './rathiTrapper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function trapped(): { g: Game; victim: string } {
  const g = startedGame({
    players: 2,
    decks: [['Rathi Trapper'], ['Grizzly Bears']],
    scripts: createRegistry([RATHI_TRAPPER_SCRIPT]),
  });
  const trapper = put(g, 'p1', 'Rathi Trapper');
  const victim = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: trapper,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, victim };
}

describe('Rathi Trapper', () => {
  test('the target ends tapped', () => {
    const { g, victim } = trapped();
    expect(g.state.cards[victim]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = trapped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
