// `Planar Cleansing` — everything but the lands goes.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PLANAR_CLEANSING_SCRIPT } from './planarCleansing';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cleansed(): { g: Game; mine: string; theirs: string; ring: string; land: string } {
  const g = startedGame({
    players: 2,
    decks: [['Planar Cleansing', 'Grizzly Bears'], ['Colossal Dreadmaw', 'Sol Ring']],
    scripts: createRegistry([PLANAR_CLEANSING_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  const ring = put(g, 'p2', 'Sol Ring');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  const spell = put(g, 'p1', 'Planar Cleansing', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, ring, land };
}

describe('Planar Cleansing', () => {
  test('creatures and artifacts on both sides die; the land stands', () => {
    const { g, mine, theirs, ring, land } = cleansed();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = cleansed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
