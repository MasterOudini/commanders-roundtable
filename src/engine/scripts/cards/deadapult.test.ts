// `Deadapult` — the Zombie predicate feeding an enchantment ping: the Zombie
// pays, a bear does not, and the player target bleeds 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEADAPULT_SCRIPT } from './deadapult';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DEADAPULT = 'Deadapult';
const ZOMBIE = 'Walking Corpse';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; deadapult: InstanceId; zombie: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DEADAPULT, ZOMBIE, BEARS], []],
    scripts: createRegistry([DEADAPULT_SCRIPT]),
  });
  const deadapult = put(g, 'p1', DEADAPULT);
  const zombie = put(g, 'p1', ZOMBIE);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  return { g, deadapult, zombie, bears };
}

describe('Deadapult', () => {
  test('the Zombie pays and the target player takes 2', () => {
    const { g, deadapult, zombie } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: deadapult, abilityIndex: 0, sacrifice: zombie }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[zombie]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('a bear is no Zombie', () => {
    const { g, deadapult, bears } = game();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: deadapult, abilityIndex: 0, sacrifice: bears });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, deadapult, zombie } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: deadapult, abilityIndex: 0, sacrifice: zombie }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
