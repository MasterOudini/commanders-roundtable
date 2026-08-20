// `Planar Birth` — every basic in every graveyard stands up tapped for
// its owner; a nonbasic stays down.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PLANAR_BIRTH_SCRIPT } from './planarBirth';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reborn(): { g: Game; island: InstanceId; mountain: InstanceId; core: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Planar Birth', "Phyrexia's Core"], []],
    scripts: createRegistry([PLANAR_BIRTH_SCRIPT]),
  });
  const island = put(g, 'p1', 'Island', 'graveyard');
  const core = put(g, 'p1', "Phyrexia's Core", 'graveyard');
  const mountain = put(g, 'p2', 'Mountain', 'graveyard');
  settle(g);
  const spell = put(g, 'p1', 'Planar Birth', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['W', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, island, mountain, core };
}

describe('Planar Birth', () => {
  test('both basics rise tapped under their owners; the nonbasic stays', () => {
    const { g, island, mountain, core } = reborn();
    expect(g.state.cards[island]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[island]?.controller).toBe('p1');
    expect(g.state.cards[island]?.tapped).toBe(true);
    expect(g.state.cards[mountain]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mountain]?.controller).toBe('p2');
    expect(g.state.cards[mountain]?.tapped).toBe(true);
    expect(g.state.cards[core]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = reborn();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
