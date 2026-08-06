// `Eager Trufflesnout` — connecting with a player pays a Food.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EAGER_TRUFFLESNOUT_SCRIPT } from './eagerTrufflesnout';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BOAR = 'Eager Trufflesnout';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function connected(): Game {
  const g = startedGame({
    players: 2,
    decks: [[BOAR], []],
    scripts: createRegistry([EAGER_TRUFFLESNOUT_SCRIPT]),
  });
  const boar = put(g, 'p1', BOAR);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: boar, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(
    g,
    (s) =>
      s.priority.awaiting?.kind === 'declareBlockers' ||
      s.turn.step === 'postcombatMain' ||
      s.gamePhase === 'finished',
    20_000,
  );
  if (g.state.priority.awaiting?.kind === 'declareBlockers') {
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [] }));
  }
  advanceUntil(g, (s) => s.turn.step === 'postcombatMain' || s.gamePhase === 'finished', 20_000);
  settle(g);
  return g;
}

describe('Eager Trufflesnout', () => {
  test('combat damage to a player creates a Food token', () => {
    const g = connected();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = connected();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
