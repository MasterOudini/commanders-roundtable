// `Destructive Digger` — an artifact or a LAND pays; a creature does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DESTRUCTIVE_DIGGER_SCRIPT } from './destructiveDigger';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DIGGER = 'Destructive Digger';
const MOUNTAIN = 'Mountain';
const BEARS = 'Grizzly Bears';

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

function board(): { g: Game; digger: InstanceId; mountain: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DIGGER, MOUNTAIN, BEARS], []],
    scripts: createRegistry([DESTRUCTIVE_DIGGER_SCRIPT]),
  });
  const digger = put(g, 'p1', DIGGER);
  const mountain = put(g, 'p1', MOUNTAIN);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  // {T} in the cost — the Digger must be past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, digger, mountain, bears };
}

describe('Destructive Digger', () => {
  test('a land pays the OR cost, and the draw arrives', () => {
    const { g, digger, mountain } = board();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: digger, abilityIndex: 0, sacrifice: mountain }));
    expect(g.state.cards[mountain]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[digger]?.zone.kind).toBe('battlefield');
  });

  test('a creature is NEITHER arm of "an artifact or land"', () => {
    const { g, digger, bears } = board();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: digger, abilityIndex: 0, sacrifice: bears });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, digger, mountain } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: digger, abilityIndex: 0, sacrifice: mountain }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
