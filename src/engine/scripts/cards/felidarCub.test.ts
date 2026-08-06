// `Felidar Cub` — the free sacrifice kills the enchantment.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FELIDAR_CUB_SCRIPT } from './felidarCub';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CUB = 'Felidar Cub';
const ENCHANTMENT = 'Contemplation';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; cub: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CUB], [ENCHANTMENT]],
    scripts: createRegistry([FELIDAR_CUB_SCRIPT]),
  });
  const cub = put(g, 'p1', CUB);
  const theirs = put(g, 'p2', ENCHANTMENT);
  settle(g);
  return { g, cub, theirs };
}

describe('Felidar Cub', () => {
  test('no mana anywhere: the sacrifice alone destroys the enchantment', () => {
    const { g, cub, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cub, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    expect(g.state.cards[cub]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, cub, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cub, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
