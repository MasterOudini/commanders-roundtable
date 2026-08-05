// `Ajani's Welcome` — the warden scoped to YOUR creatures: an opponent's
// creature entering gains nothing, your token does.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AJANIS_WELCOME_SCRIPT } from './ajanisWelcome';
import { SOLDIER_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WELCOME = "Ajani's Welcome";

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[WELCOME, 'Grizzly Bears'], ['Silvercoat Lion']],
    scripts: createRegistry([AJANIS_WELCOME_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe("Ajani's Welcome", () => {
  test('YOUR creature and YOUR token gain 1; an opponent’s creature gains nothing', () => {
    const g = game();
    put(g, 'p1', WELCOME);
    settle(g);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    must(
      g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
    put(g, 'p2', 'Silvercoat Lion');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', WELCOME);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
