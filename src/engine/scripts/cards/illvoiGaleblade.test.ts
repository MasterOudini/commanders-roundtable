// `Illvoi Galeblade` — {2} and its own body pay for the draw at `#a0`.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ILLVOI_GALEBLADE_SCRIPT } from './illvoiGaleblade';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GALEBLADE = 'Illvoi Galeblade';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; galeblade: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GALEBLADE], []],
    scripts: createRegistry([ILLVOI_GALEBLADE_SCRIPT]),
  });
  const galeblade = put(g, 'p1', GALEBLADE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, galeblade };
}

describe('Illvoi Galeblade', () => {
  test('paying {2} and itself draws a card', () => {
    const { g, galeblade } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: galeblade, abilityIndex: 0 }));
    settle(g);
    expect(g.state.cards[galeblade]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, galeblade } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: galeblade, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
