// `Dockside Chef` — an artifact or a CREATURE pays; a land does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DOCKSIDE_CHEF_SCRIPT } from './docksideChef';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHEF = 'Dockside Chef';
const BEARS = 'Grizzly Bears';
const MOUNTAIN = 'Mountain';

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

function board(): { g: Game; chef: InstanceId; bears: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CHEF, BEARS, MOUNTAIN], []],
    scripts: createRegistry([DOCKSIDE_CHEF_SCRIPT]),
  });
  const chef = put(g, 'p1', CHEF);
  const bears = put(g, 'p1', BEARS);
  const mountain = put(g, 'p1', MOUNTAIN);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, chef, bears, mountain };
}

describe('Dockside Chef', () => {
  test('a creature pays the OR cost, and the draw arrives', () => {
    const { g, chef, bears } = board();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: chef, abilityIndex: 0, sacrifice: bears }));
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[chef]?.zone.kind).toBe('battlefield');
  });

  test('a LAND is neither arm of "an artifact or creature"', () => {
    const { g, chef, mountain } = board();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: chef, abilityIndex: 0, sacrifice: mountain });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, chef, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: chef, abilityIndex: 0, sacrifice: bears }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
