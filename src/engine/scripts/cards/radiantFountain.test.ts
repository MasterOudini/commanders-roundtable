// `Radiant Fountain` — a LAND with an ETB trigger, which is the case that
// proves the funnel and the bus agree: the same `CardsMoved` that D134's
// enters-tapped machinery reads is the one this trigger fires from.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RADIANT_FOUNTAIN_SCRIPT } from './radiantFountain';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const FOUNTAIN = 'Radiant Fountain';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[FOUNTAIN, 'Grizzly Bears'], []],
    scripts: createRegistry([RADIANT_FOUNTAIN_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Radiant Fountain', () => {
  test('its own entry gains its controller 2, asserted on the EVENT', () => {
    const g = game();
    const before = g.log.filter((e) => e.body.t === 'LifeChanged').length;
    put(g, 'p1', FOUNTAIN);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
    expect(g.state.players['p2']?.life).toBe(40);
    expect(g.log.filter((e) => e.body.t === 'LifeChanged').length).toBe(before + 1);
    expect(
      g.log.some((e) => e.body.t === 'LifeChanged' && e.body.player === 'p1' && e.body.delta === 2),
    ).toBe(true);
  });

  test('a DIFFERENT card entering does not fire it — the trigger is its OWN entry', () => {
    const g = game();
    put(g, 'p1', FOUNTAIN);
    settle(g);
    const before = g.log.filter((e) => e.body.t === 'LifeChanged').length;
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(g.log.filter((e) => e.body.t === 'LifeChanged').length).toBe(before);
  });

  test('entering from a GRAVEYARD fires too — "enters" is any arrival, not a land drop', () => {
    const g = game();
    const id = put(g, 'p1', FOUNTAIN, 'graveyard');
    settle(g);
    const before = g.state.players['p1']?.life ?? -1;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: id,
        to: { kind: 'battlefield', player: 'p1' },
      }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(before + 2);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', FOUNTAIN);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
