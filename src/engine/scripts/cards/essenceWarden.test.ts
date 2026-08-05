// `Essence Warden` — Soul Warden's twin to the word. The exhaustive matrix
// (own entry, lands, treasures, the two-def break test) lives in
// `soulWarden.test.ts`; this file proves THIS card's script fires on both
// event kinds and replays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ESSENCE_WARDEN_SCRIPT } from './essenceWarden';
import { SOLDIER_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WARDEN = 'Essence Warden';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[WARDEN, 'Grizzly Bears'], []],
    scripts: createRegistry([ESSENCE_WARDEN_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Essence Warden', () => {
  test('a creature card entering gains 1 for the WARDEN’S controller', () => {
    const g = game();
    put(g, 'p1', WARDEN);
    settle(g);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(
      g.log.some((e) => e.body.t === 'LifeChanged' && e.body.player === 'p1' && e.body.delta === 1),
    ).toBe(true);
  });

  test('a creature token entering gains 1 — the TokenCreated def', () => {
    const g = game();
    put(g, 'p1', WARDEN);
    settle(g);
    must(
      g.submit({ t: 'ManualCreateToken', player: 'p2', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', WARDEN);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
