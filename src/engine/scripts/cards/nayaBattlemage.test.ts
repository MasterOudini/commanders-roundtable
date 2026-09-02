// `Naya Battlemage` — {R} and the tap pump +2/+0; {W} and the tap tap a creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NAYA_BATTLEMAGE_SCRIPT } from './nayaBattlemage';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGE = 'Naya Battlemage';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mage: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGE, BEARS], [BEARS]],
    scripts: createRegistry([NAYA_BATTLEMAGE_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const mage = put(g, 'p1', MAGE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, mage, mine, theirs };
}

function power(g: Game, id: InstanceId): number | null {
  const d = deps(createRegistry([NAYA_BATTLEMAGE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).power;
}

describe('Naya Battlemage', () => {
  test('{R}, {T}: +2/+0', () => {
    const { g, mage, mine } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(power(g, mine)).toBe(4);
    expect(g.state.cards[mage]?.tapped).toBe(true);
  });

  test("{W}, {T}: the opponent's creature is tapped", () => {
    const { g, mage, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
    expect(g.state.cards[mage]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, mage, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
