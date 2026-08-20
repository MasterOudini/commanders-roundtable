// `North Pole Gates` — tapped entry; the sacrifice-draw pays and draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NORTH_POLE_GATES_SCRIPT } from './northPoleGates';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gated(): { g: Game; gates: InstanceId; enteredTapped: boolean } {
  const g = startedGame({
    players: 2,
    decks: [['North Pole Gates'], []],
    scripts: createRegistry([NORTH_POLE_GATES_SCRIPT]),
  });
  const gates = put(g, 'p1', 'North Pole Gates');
  settle(g);
  const enteredTapped = g.state.cards[gates]?.tapped === true;
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [gates], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, gates, enteredTapped };
}

describe('North Pole Gates', () => {
  test('enters tapped; the sacrifice-draw pays and draws', () => {
    const { g, gates, enteredTapped } = gated();
    expect(enteredTapped).toBe(true);
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: gates, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[gates]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, gates } = gated();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: gates, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
