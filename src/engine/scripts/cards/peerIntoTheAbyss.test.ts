// `Peer into the Abyss` — half the library drawn, half the life gone,
// both rounded up.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PEER_INTO_THE_ABYSS_SCRIPT } from './peerIntoTheAbyss';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

// The spell can resolve INSIDE its own submit under default stops, so the
// baselines are captured BEFORE the cast and returned beside the game.
function peered(): { g: Game; lib: number; hand: number; life: number } {
  const g = startedGame({
    players: 2,
    decks: [['Peer into the Abyss'], []],
    scripts: createRegistry([PEER_INTO_THE_ABYSS_SCRIPT]),
  });
  settle(g);
  const spell = put(g, 'p1', 'Peer into the Abyss', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['B', 'B', 'B', 'C', 'C', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  const lib = (g.state.zones.library['p2'] ?? []).length;
  const hand = (g.state.zones.hand['p2'] ?? []).length;
  const life = g.state.players['p2']?.life ?? 0;
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return { g, lib, hand, life };
}

describe('Peer into the Abyss', () => {
  test('draws ceil(library/2) and loses ceil(life/2)', () => {
    const { g, lib, hand, life } = peered();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(hand + Math.ceil(lib / 2));
    expect((g.state.zones.library['p2'] ?? []).length).toBe(lib - Math.ceil(lib / 2));
    expect(g.state.players['p2']?.life).toBe(life - Math.ceil(life / 2));
  });

  test('replays to the same hash', () => {
    const { g } = peered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
