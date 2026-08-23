// `Thornwood Falls` — both printed entry rules: tapped, and the life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THORNWOOD_FALLS_SCRIPT } from './thornwoodFalls';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FALLS = 'Thornwood Falls';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; falls: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FALLS], []],
    scripts: createRegistry([THORNWOOD_FALLS_SCRIPT]),
  });
  const falls = put(g, 'p1', FALLS, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: falls }));
  settle(g);
  return { g, falls };
}

describe('Thornwood Falls', () => {
  test('enters tapped AND gains 1 life', () => {
    const { g, falls } = entered();
    expect(g.state.cards[falls]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
