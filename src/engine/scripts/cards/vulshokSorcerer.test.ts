// `Vulshok Sorcerer` — HASTE is the point: the ping goes the turn it lands,
// which Cunning Sparkmage's own test cannot show because it waits a turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VULSHOK_SORCERER_SCRIPT } from './vulshokSorcerer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SORCERER = 'Vulshok Sorcerer';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; sorcerer: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SORCERER], [BEARS]],
    scripts: createRegistry([VULSHOK_SORCERER_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  const sorcerer = put(g, 'p1', SORCERER);
  settle(g);
  return { g, sorcerer, bears };
}

describe('Vulshok Sorcerer', () => {
  test('haste lets it ping the turn it arrives', () => {
    const { g, sorcerer } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sorcerer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[sorcerer]?.tapped).toBe(true);
  });

  test('the same 1 marks a creature', () => {
    const { g, sorcerer, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sorcerer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.damage).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, sorcerer } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sorcerer, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
