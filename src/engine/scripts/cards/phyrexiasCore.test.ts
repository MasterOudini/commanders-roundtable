// `Phyrexia's Core` — an artifact goes in, a life comes out, the land stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PHYREXIAS_CORE_SCRIPT } from './phyrexiasCore';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cored(): { g: Game; core: string; ring: string } {
  const g = startedGame({
    players: 2,
    decks: [["Phyrexia's Core", 'Sol Ring'], []],
    scripts: createRegistry([PHYREXIAS_CORE_SCRIPT]),
  });
  const core = put(g, 'p1', "Phyrexia's Core");
  const ring = put(g, 'p1', 'Sol Ring');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({ t: 'ActivateAbility', player: 'p1', card: core, abilityIndex: 1, sacrifice: ring }),
  );
  settle(g);
  return { g, core, ring };
}

describe('Phyrexia s Core', () => {
  test('eats the artifact and pays one life', () => {
    const { g, core, ring } = cored();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[core]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = cored();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
