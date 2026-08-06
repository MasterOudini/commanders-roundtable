// `Deeproot Pilgrimage` — the first tap-watcher: a NONTOKEN Merfolk turning
// pays a hexproof Merfolk token; the token it made turning pays nothing (the
// nontoken filter, asserted from both sides).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEEPROOT_PILGRIMAGE_SCRIPT } from './deeprootPilgrimage';
import { MERFOLK_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PILGRIMAGE = 'Deeproot Pilgrimage';
const MERFOLK = 'Merfolk of the Pearl Trident';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function merfolkTokens(g: Game): readonly InstanceId[] {
  return Object.keys(g.state.cards).filter(
    (id) => g.state.cards[id]?.isToken && g.state.cards[id]?.printingId === MERFOLK_TOKEN.scryfallId,
  ) as InstanceId[];
}

function game(): { g: Game; merfolk: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PILGRIMAGE, MERFOLK], []],
    scripts: createRegistry([DEEPROOT_PILGRIMAGE_SCRIPT]),
  });
  put(g, 'p1', PILGRIMAGE);
  const merfolk = put(g, 'p1', MERFOLK);
  settle(g);
  return { g, merfolk };
}

describe('Deeproot Pilgrimage', () => {
  test('a nontoken Merfolk turning pays; the TOKEN it made turning pays nothing', () => {
    const { g, merfolk } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [merfolk], tapped: true }));
    settle(g);
    const first = merfolkTokens(g);
    expect(first).toHaveLength(1);
    // Tap the TOKEN — nontoken filters it out, so nothing more arrives.
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [first[0] as InstanceId], tapped: true }));
    settle(g);
    expect(merfolkTokens(g)).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const { g, merfolk } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [merfolk], tapped: true }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
