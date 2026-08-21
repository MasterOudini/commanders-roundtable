// `Rooftop Bypass` — a nontoken creature connecting pays one Assassin.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROOFTOP_BYPASS_SCRIPT } from './rooftopBypass';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function bypassed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Rooftop Bypass', 'Grizzly Bears'], []],
    scripts: createRegistry([ROOFTOP_BYPASS_SCRIPT]),
  });
  put(g, 'p1', 'Rooftop Bypass');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 120_000);
  settle(g);
  return g;
}

describe('Rooftop Bypass', () => {
  test('a nontoken connect pays one Assassin', () => {
    const g = bypassed();
    expect(tokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = bypassed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
