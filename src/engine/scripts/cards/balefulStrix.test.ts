// `Baleful Strix` — an ETB draw on a card that is MOSTLY keywords: the flying
// and deathtouch lines are Tier-2's, so the script owes exactly the trigger,
// and this file proves it fires on its own entry and nobody else's.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BALEFUL_STRIX_SCRIPT } from './balefulStrix';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const STRIX = 'Baleful Strix';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[STRIX, 'Grizzly Bears'], []],
    scripts: createRegistry([BALEFUL_STRIX_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Baleful Strix', () => {
  test('its entry draws its controller one card', () => {
    const g = game();
    // Staged through the graveyard so the hand arithmetic cannot race the
    // entry — see wallOfOmens.test.ts for the measured reason.
    const id = put(g, 'p1', STRIX, 'graveyard');
    settle(g);
    const before = idsIn(g, 'p1', 'hand').length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }),
    );
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('ANOTHER creature entering does not fire it — the trigger is its own entry', () => {
    const g = game();
    put(g, 'p1', STRIX);
    settle(g);
    const fired = () =>
      g.log.filter(
        (e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.label.startsWith('Baleful Strix'),
      ).length;
    const before = fired();
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(fired()).toBe(before);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', STRIX);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
