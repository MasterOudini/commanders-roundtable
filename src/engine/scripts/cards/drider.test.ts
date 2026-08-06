// `Drider` — connecting with a player pays a 2/1 Spider.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRIDER_SCRIPT } from './drider';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const DRIDER = 'Drider';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function connected(): Game {
  const g = startedGame({
    players: 2,
    decks: [[DRIDER], []],
    scripts: createRegistry([DRIDER_SCRIPT]),
  });
  const drider = put(g, 'p1', DRIDER);
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
      attackers: [{ card: drider, defender: { kind: 'player', id: 'p2' } }],
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

describe('Drider', () => {
  test('combat damage to a player creates the 2/1 Spider', () => {
    const g = connected();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Spider')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = connected();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
