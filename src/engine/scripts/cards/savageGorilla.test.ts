// `Savage Gorilla` — the off-color self-sac: -3/-3 kills the Bears
// through the SBA, the draw arrives, the Gorilla is spent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAVAGE_GORILLA_SCRIPT } from './savageGorilla';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swung(): { g: Game; gorilla: InstanceId; bears: InstanceId; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Savage Gorilla'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([SAVAGE_GORILLA_SCRIPT]),
  });
  const gorilla = put(g, 'p1', 'Savage Gorilla');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: gorilla,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return { g, gorilla, bears, mid };
}

describe('Savage Gorilla', () => {
  test('the Bears die at -3/-3, the draw arrives, the Gorilla is spent', () => {
    const { g, gorilla, bears, mid } = swung();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[gorilla]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g } = swung();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
