// `Izzet Chronarch` — entering returns a chosen instant from MY graveyard to
// my hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { IZZET_CHRONARCH_SCRIPT } from './izzetChronarch';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHRONARCH = 'Izzet Chronarch';
const BOLT = 'Lightning Bolt';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function returned(): { g: Game; bolt: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CHRONARCH, BOLT], []],
    scripts: createRegistry([IZZET_CHRONARCH_SCRIPT]),
  });
  const bolt = put(g, 'p1', BOLT, 'graveyard');
  put(g, 'p1', CHRONARCH);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bolt }] }));
  settle(g);
  return { g, bolt };
}

describe('Izzet Chronarch', () => {
  test('entering returns the chosen instant to hand', () => {
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
