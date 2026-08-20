// `Palace Familiar` — dying draws; the trigger line is Outlaw Medic's.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PALACE_FAMILIAR_SCRIPT } from './palaceFamiliar';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function familiared(): { g: Game; bird: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Palace Familiar'], []],
    scripts: createRegistry([PALACE_FAMILIAR_SCRIPT]),
  });
  const bird = put(g, 'p1', 'Palace Familiar');
  settle(g);
  return { g, bird };
}

describe('Palace Familiar', () => {
  test('dying draws a card', () => {
    const { g, bird } = familiared();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bird,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, bird } = familiared();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bird,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
