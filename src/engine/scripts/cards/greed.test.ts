// `Greed` — {B} and 2 LIFE buy a card: both halves of the price asserted.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GREED_SCRIPT } from './greed';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GREED = 'Greed';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; greed: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GREED], []],
    scripts: createRegistry([GREED_SCRIPT]),
  });
  const greed = put(g, 'p1', GREED);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, greed };
}

describe('Greed', () => {
  test('draws a card for {B} and 2 life — the life is really charged', () => {
    const { g, greed } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: greed, abilityIndex: 0 }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
    expect(g.state.players.p1?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g, greed } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: greed, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
