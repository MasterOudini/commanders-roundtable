// `Cunning Sparkmage` — the {T} ping past summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CUNNING_SPARKMAGE_SCRIPT } from './cunningSparkmage';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPARKMAGE = 'Cunning Sparkmage';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; mage: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPARKMAGE], []],
    scripts: createRegistry([CUNNING_SPARKMAGE_SCRIPT]),
  });
  const mage = put(g, 'p1', SPARKMAGE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 20_000);
  return { g, mage };
}

describe('Cunning Sparkmage', () => {
  test('taps, aims at a player, deals 1', () => {
    const { g, mage } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[mage]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, mage } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
