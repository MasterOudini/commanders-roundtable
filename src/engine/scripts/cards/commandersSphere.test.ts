// `Commander's Sphere` — the FREE self-sacrifice draw: no mana, no tap, just
// the Sphere.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COMMANDERS_SPHERE_SCRIPT } from './commandersSphere';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPHERE = "Commander's Sphere";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; sphere: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPHERE], []],
    scripts: createRegistry([COMMANDERS_SPHERE_SCRIPT]),
  });
  const sphere = put(g, 'p1', SPHERE);
  settle(g);
  return { g, sphere };
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
        ),
    ).length;
}

describe("Commander's Sphere", () => {
  test('draws a card for FREE with the Sphere spent as the whole cost', () => {
    const { g, sphere } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sphere, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[sphere]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, sphere } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sphere, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
