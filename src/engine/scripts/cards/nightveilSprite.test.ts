// `Nightveil Sprite` — attacking asks the surveil 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NIGHTVEIL_SPRITE_SCRIPT } from './nightveilSprite';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sprited(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Nightveil Sprite'], []],
    scripts: createRegistry([NIGHTVEIL_SPRITE_SCRIPT]),
  });
  const sprite = put(g, 'p1', 'Nightveil Sprite');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: sprite, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  return g;
}

describe('Nightveil Sprite', () => {
  test('attacking asks a surveil 1 that can BURY', () => {
    const g = sprited();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    settle(g);
  });

  test('replays to the same hash', () => {
    const g = sprited();
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
