// `Monk Realist` — the entry asks and the enchantment dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MONK_REALIST_SCRIPT } from './monkRealist';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function realized(): { g: Game; flame: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Monk Realist'], ['Captive Flame']],
    scripts: createRegistry([MONK_REALIST_SCRIPT]),
  });
  const flame = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Monk Realist');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: flame }] }));
  settle(g);
  return { g, flame };
}

describe('Monk Realist', () => {
  test('the entry destroys the targeted enchantment', () => {
    const { g, flame } = realized();
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = realized();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
