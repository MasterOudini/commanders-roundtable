// `The Surgical Bay` — enters tapped, and the sac-draw eats the land for a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THE_SURGICAL_BAY_SCRIPT } from './theSurgicalBay';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPHERE = 'The Surgical Bay';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log.slice(from).reduce(
    (n, e) =>
      e.body.t === 'CardsMoved'
        ? n +
          e.body.moves.filter(
            (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
          ).length
        : n,
    0,
  );
}

function game(): { g: Game; sphere: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPHERE], []],
    scripts: createRegistry([THE_SURGICAL_BAY_SCRIPT]),
  });
  const sphere = put(g, 'p1', SPHERE);
  settle(g);
  return { g, sphere };
}

/** Straightens the land (it entered tapped) and funds the {1}{U}. */
function ready(g: Game, sphere: InstanceId): void {
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [sphere], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
}

describe('The Surgical Bay', () => {
  test('enters TAPPED — the built-in rule', () => {
    const { g, sphere } = game();
    expect(g.state.cards[sphere]?.tapped).toBe(true);
  });

  test('it eats ITSELF for a card', () => {
    const { g, sphere } = game();
    ready(g, sphere);
    const from = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sphere, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[sphere]?.zone.kind).toBe('graveyard');
    expect(drawsFor(g, 'p1', from)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, sphere } = game();
    ready(g, sphere);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sphere, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
