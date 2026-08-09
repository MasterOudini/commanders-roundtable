// `Fodder Cannon` — a creature pays, and the 4 damage kills a 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FODDER_CANNON_SCRIPT } from './fodderCannon';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CANNON = 'Fodder Cannon';
const BEARS = 'Grizzly Bears';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; cannon: InstanceId; myBears: InstanceId; land: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CANNON, BEARS, MOUNTAIN], [BEARS]],
    scripts: createRegistry([FODDER_CANNON_SCRIPT]),
  });
  const cannon = put(g, 'p1', CANNON);
  const myBears = put(g, 'p1', BEARS);
  const land = put(g, 'p1', MOUNTAIN);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, cannon, myBears, land, theirs };
}

describe('Fodder Cannon', () => {
  test('a creature pays and the 4 damage kills the target', () => {
    const { g, cannon, myBears, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cannon, abilityIndex: 0, sacrifice: myBears }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    expect(g.state.cards[myBears]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[cannon]?.zone.kind).toBe('battlefield');
  });

  test('a LAND cannot pay the creature-only cost', () => {
    const { g, cannon, land } = armed();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: cannon, abilityIndex: 0, sacrifice: land });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, cannon, myBears, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cannon, abilityIndex: 0, sacrifice: myBears }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
