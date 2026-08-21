// `Reliquary Monk` — dying breaks an artifact through the arrow.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RELIQUARY_MONK_SCRIPT } from './reliquaryMonk';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function monked(): { g: Game; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Reliquary Monk'], ['Sol Ring']],
    scripts: createRegistry([RELIQUARY_MONK_SCRIPT]),
  });
  const monk = put(g, 'p1', 'Reliquary Monk');
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: monk, to: { kind: 'graveyard', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
  settle(g);
  return { g, ring };
}

describe('Reliquary Monk', () => {
  test('the targeted artifact dies with him', () => {
    const { g, ring } = monked();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = monked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
