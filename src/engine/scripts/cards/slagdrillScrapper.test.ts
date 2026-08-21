// `Slagdrill Scrapper` — "another artifact or land": a Swamp pays for the
// draw, and the Scrapper itself is refused as its own price.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SLAGDRILL_SCRAPPER_SCRIPT } from './slagdrillScrapper';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; scrapper: InstanceId; swamp: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Slagdrill Scrapper', 'Swamp'], []],
    scripts: createRegistry([SLAGDRILL_SCRAPPER_SCRIPT]),
  });
  const scrapper = put(g, 'p1', 'Slagdrill Scrapper');
  const swamp = put(g, 'p1', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  return { g, scrapper, swamp };
}

describe('Slagdrill Scrapper', () => {
  test('a sacrificed Swamp pays for the draw', () => {
    const { g, scrapper, swamp } = ready();
    const before = (g.state.zones.hand['p1'] ?? []).length;
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: scrapper,
        abilityIndex: 0,
        sacrifice: swamp,
      }),
    );
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
  });

  test('the Scrapper is refused as its own price — the cost says another', () => {
    const { g, scrapper } = ready();
    const res = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: scrapper,
      abilityIndex: 0,
      sacrifice: scrapper,
    });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, scrapper, swamp } = ready();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: scrapper,
        abilityIndex: 0,
        sacrifice: swamp,
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
