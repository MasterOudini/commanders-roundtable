// `Living Lightning` — dying returns a chosen instant from MY graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LIVING_LIGHTNING_SCRIPT } from './livingLightning';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LIGHTNING = 'Living Lightning';
const BOLT = 'Lightning Bolt';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function returned(): { g: Game; bolt: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LIGHTNING, BOLT], []],
    scripts: createRegistry([LIVING_LIGHTNING_SCRIPT]),
  });
  const bolt = put(g, 'p1', BOLT, 'graveyard');
  const lightning = put(g, 'p1', LIGHTNING);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: lightning,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bolt }] }));
  settle(g);
  return { g, bolt };
}

describe('Living Lightning', () => {
  test('dying returns the chosen instant to hand', () => {
    const { g, bolt } = returned();
    const zone = g.state.cards[bolt]?.zone;
    expect(zone?.kind).toBe('hand');
    expect(zone?.kind === 'hand' && zone.player).toBe('p1');
  });

  test('replays to the same hash', () => {
    const { g } = returned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
