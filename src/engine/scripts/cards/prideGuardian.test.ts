// `Pride Guardian` — blocking pays 3; standing around pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRIDE_GUARDIAN_SCRIPT } from './prideGuardian';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function guarded(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Pride Guardian'], ['Grizzly Bears']],
    scripts: createRegistry([PRIDE_GUARDIAN_SCRIPT]),
  });
  const guardian = put(g, 'p1', 'Pride Guardian');
  const attacker = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [{ card: attacker, defender: { kind: 'player', id: 'p1' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: guardian, attacker }] }));
  settle(g);
  return g;
}

describe('Pride Guardian', () => {
  test('the block pays 3 life', () => {
    const g = guarded();
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const g = guarded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
