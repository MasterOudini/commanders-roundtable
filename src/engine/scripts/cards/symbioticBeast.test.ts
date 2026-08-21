// `Symbiotic Beast` — the same printed shape at four.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SYMBIOTIC_BEAST_SCRIPT } from './symbioticBeast';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BEAST = 'Symbiotic Beast';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function killed(): Game {
  const g = startedGame({
    players: 2,
    decks: [[BEAST], []],
    scripts: createRegistry([SYMBIOTIC_BEAST_SCRIPT]),
  });
  const beast = put(g, 'p1', BEAST);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: beast,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return g;
}

describe('Symbiotic Beast', () => {
  test('dying creates FOUR distinct 1/1 Insects', () => {
    const g = killed();
    const insects = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Insect');
    expect(insects).toHaveLength(4);
    expect(new Set(insects).size).toBe(4);
  });

  test('replays to the same hash', () => {
    const g = killed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
