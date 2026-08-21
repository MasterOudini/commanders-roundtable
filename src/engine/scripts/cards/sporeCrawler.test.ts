// `Spore Crawler` — the death pays a draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPORE_CRAWLER_SCRIPT } from './sporeCrawler';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function crawled(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Spore Crawler'], []],
    scripts: createRegistry([SPORE_CRAWLER_SCRIPT]),
  });
  const crawler = put(g, 'p1', 'Spore Crawler');
  settle(g);
  holdEverywhere(g);
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: crawler,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return { g, before };
}

describe('Spore Crawler', () => {
  test('the death draws a card', () => {
    const { g, before } = crawled();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g } = crawled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
