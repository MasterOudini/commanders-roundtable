// `Fallen Ferromancer` — the ping carries its own INFECT: a creature takes
// it as -1/-1 counters, a player as poison.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FALLEN_FERROMANCER_SCRIPT } from './fallenFerromancer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FERROMANCER = 'Fallen Ferromancer';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; ferromancer: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FERROMANCER], [BEARS]],
    scripts: createRegistry([FALLEN_FERROMANCER_SCRIPT]),
  });
  const ferromancer = put(g, 'p1', FERROMANCER);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  // {T} in the cost — past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, ferromancer, theirs };
}

describe('Fallen Ferromancer', () => {
  test('infect damage to a creature arrives as a -1/-1 counter', () => {
    const { g, ferromancer, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ferromancer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.counters['-1/-1']).toBe(1);
  });

  test('infect damage to a PLAYER arrives as poison', () => {
    const { g, ferromancer } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ferromancer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.poison).toBe(1);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g, ferromancer, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ferromancer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
