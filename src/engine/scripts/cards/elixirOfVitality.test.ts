// `Elixir of Vitality` — enters tapped (the engine's line), then a tap and
// a sacrifice buy 4 life, or eight mana more buys 8.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELIXIR_OF_VITALITY_SCRIPT } from './elixirOfVitality';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ELIXIR = 'Elixir of Vitality';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; elixir: InstanceId; tappedOnEntry: boolean } {
  const g = startedGame({
    players: 2,
    decks: [[ELIXIR], []],
    scripts: createRegistry([ELIXIR_OF_VITALITY_SCRIPT]),
  });
  const elixir = put(g, 'p1', ELIXIR);
  settle(g);
  const tappedOnEntry = g.state.cards[elixir]?.tapped === true;
  // Past the next untap step, so the {T} costs can be paid.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, elixir, tappedOnEntry };
}

describe('Elixir of Vitality', () => {
  test('it enters tapped', () => {
    const { tappedOnEntry } = placed();
    expect(tappedOnEntry).toBe(true);
  });

  test('{T}, sacrifice: 4 life', () => {
    const { g, elixir } = placed();
    expect(g.state.cards[elixir]?.tapped).toBe(false);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: elixir, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(44);
    expect(g.state.cards[elixir]?.zone.kind).toBe('graveyard');
  });

  test('{8}, {T}, sacrifice: 8 life', () => {
    const { g, elixir } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: elixir, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(48);
    expect(g.state.cards[elixir]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, elixir } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: elixir, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
