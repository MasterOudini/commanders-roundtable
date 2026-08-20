// `Moonrise Cleric` — attacking gains 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOONRISE_CLERIC_SCRIPT } from './moonriseCleric';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function clericked(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Moonrise Cleric'], []],
    scripts: createRegistry([MOONRISE_CLERIC_SCRIPT]),
  });
  const cleric = put(g, 'p1', 'Moonrise Cleric');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: cleric, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  settle(g);
  return g;
}

describe('Moonrise Cleric', () => {
  test('attacking gains 1', () => {
    const g = clericked();
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = clericked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
