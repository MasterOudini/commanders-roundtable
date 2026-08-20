// `Onyx Goblet` — the tap drains 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ONYX_GOBLET_SCRIPT } from './onyxGoblet';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gobleted(): { g: Game; goblet: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Onyx Goblet'], []],
    scripts: createRegistry([ONYX_GOBLET_SCRIPT]),
  });
  const goblet = put(g, 'p1', 'Onyx Goblet');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, goblet };
}

describe('Onyx Goblet', () => {
  test('the tap drains the targeted player for 1', () => {
    const { g, goblet } = gobleted();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: goblet,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[goblet]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, goblet } = gobleted();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: goblet,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
