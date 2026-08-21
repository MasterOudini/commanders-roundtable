// `Swiftwater Cliffs` — both printed entry rules: tapped (the built-in) and
// the life (the def). The mana line is the engine's own.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SWIFTWATER_CLIFFS_SCRIPT } from './swiftwaterCliffs';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CLIFFS = 'Swiftwater Cliffs';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; cliffs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CLIFFS], []],
    scripts: createRegistry([SWIFTWATER_CLIFFS_SCRIPT]),
  });
  const cliffs = put(g, 'p1', CLIFFS, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: cliffs }));
  settle(g);
  return { g, cliffs };
}

describe('Swiftwater Cliffs', () => {
  test('enters tapped AND gains 1 life — both printed rules', () => {
    const { g, cliffs } = entered();
    expect(g.state.cards[cliffs]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[cliffs]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
