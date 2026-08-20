// `Polluted Dead` — dying takes a land with it, through the answer arrow.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { POLLUTED_DEAD_SCRIPT } from './pollutedDead';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function polluted(): { g: Game; dead: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Polluted Dead'], []],
    scripts: createRegistry([POLLUTED_DEAD_SCRIPT]),
  });
  const dead = put(g, 'p1', 'Polluted Dead');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: dead, to: { kind: 'graveyard', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
  settle(g);
  return { g, dead, land };
}

describe('Polluted Dead', () => {
  test('the targeted land follows it to the graveyard', () => {
    const { g, dead, land } = polluted();
    expect(g.state.cards[dead]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = polluted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
