// `Knight of Doves` — my enchantment dying pays a Bird; my CREATURE dying
// pays nothing (the type filter).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KNIGHT_OF_DOVES_SCRIPT } from './knightOfDoves';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const KNIGHT = 'Knight of Doves';
const LEVITATION = 'Levitation';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function birds(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Bird').length;
}

describe('Knight of Doves', () => {
  test('my enchantment dying creates the flying Bird', () => {
    const g = startedGame({
      players: 2,
      decks: [[KNIGHT, LEVITATION], []],
      scripts: createRegistry([KNIGHT_OF_DOVES_SCRIPT]),
    });
    put(g, 'p1', KNIGHT);
    const levitation = put(g, 'p1', LEVITATION);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: levitation,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(birds(g)).toBe(1);
  });

  test('my CREATURE dying pays nothing — the type filter holds', () => {
    const g = startedGame({
      players: 2,
      decks: [[KNIGHT, BEARS], []],
      scripts: createRegistry([KNIGHT_OF_DOVES_SCRIPT]),
    });
    put(g, 'p1', KNIGHT);
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(birds(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[KNIGHT, LEVITATION], []],
      scripts: createRegistry([KNIGHT_OF_DOVES_SCRIPT]),
    });
    put(g, 'p1', KNIGHT);
    const levitation = put(g, 'p1', LEVITATION);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: levitation,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
