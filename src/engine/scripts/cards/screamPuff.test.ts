// `Scream Puff` — connecting pays a Food.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCREAM_PUFF_SCRIPT } from './screamPuff';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function puffed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Scream Puff'], []],
    scripts: createRegistry([SCREAM_PUFF_SCRIPT]),
  });
  const puff = put(g, 'p1', 'Scream Puff');
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
      attackers: [{ card: puff, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 120_000);
  settle(g);
  return g;
}

describe('Scream Puff', () => {
  test('connecting pays one Food', () => {
    const g = puffed();
    expect(tokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = puffed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
