// `Goblin Firebomb` — {7},{T},Sacrifice: destroy target permanent; the bomb
// stays spent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_FIREBOMB_SCRIPT } from './goblinFirebomb';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FIREBOMB = 'Goblin Firebomb';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; firebomb: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FIREBOMB], [BEARS]],
    scripts: createRegistry([GOBLIN_FIREBOMB_SCRIPT]),
  });
  const firebomb = put(g, 'p1', FIREBOMB);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  return { g, firebomb, bears };
}

describe('Goblin Firebomb', () => {
  test('destroys the target permanent and dies doing it', () => {
    const { g, firebomb, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: firebomb,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[firebomb]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, firebomb, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: firebomb,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
