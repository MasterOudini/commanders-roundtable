// `Oxidda Scrapmelter` — the entry melts the targeted artifact.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OXIDDA_SCRAPMELTER_SCRIPT } from './oxiddaScrapmelter';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function melted(): { g: Game; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Oxidda Scrapmelter'], ['Sol Ring']],
    scripts: createRegistry([OXIDDA_SCRAPMELTER_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Oxidda Scrapmelter');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
  settle(g);
  return { g, ring };
}

describe('Oxidda Scrapmelter', () => {
  test('the entry destroys the targeted artifact', () => {
    const { g, ring } = melted();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = melted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
