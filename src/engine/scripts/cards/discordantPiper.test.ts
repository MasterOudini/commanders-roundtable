// `Discordant Piper` — dying leaves a 0/1 Goat behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DISCORDANT_PIPER_SCRIPT } from './discordantPiper';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PIPER = 'Discordant Piper';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Discordant Piper', () => {
  test('dying creates the 0/1 Goat', () => {
    const g = startedGame({
      players: 2,
      decks: [[PIPER], []],
      scripts: createRegistry([DISCORDANT_PIPER_SCRIPT]),
    });
    const piper = put(g, 'p1', PIPER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: piper, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Goat')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[PIPER], []],
      scripts: createRegistry([DISCORDANT_PIPER_SCRIPT]),
    });
    const piper = put(g, 'p1', PIPER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: piper, to: { kind: 'graveyard', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
