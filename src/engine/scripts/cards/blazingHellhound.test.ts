// `Blazing Hellhound` — "another creature": the Hellhound is a creature and
// still can never feed itself; the other one pays and the ping lands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLAZING_HELLHOUND_SCRIPT } from './blazingHellhound';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HOUND = 'Blazing Hellhound';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; hound: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HOUND, BEARS], []],
    scripts: createRegistry([BLAZING_HELLHOUND_SCRIPT]),
  });
  const hound = put(g, 'p1', HOUND);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, hound, bears };
}

describe('Blazing Hellhound', () => {
  test('the OTHER creature pays and the target player takes 1', () => {
    const { g, hound, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hound, abilityIndex: 0, sacrifice: bears }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('"another" refuses the Hellhound itself', () => {
    const { g, hound } = game();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: hound, abilityIndex: 0, sacrifice: hound });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
    expect(g.state.cards[hound]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, hound, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hound, abilityIndex: 0, sacrifice: bears }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
