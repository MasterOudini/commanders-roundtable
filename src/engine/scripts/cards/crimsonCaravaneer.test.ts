// `Crimson Caravaneer` — a DOUBLE STRIKER's combat-damage trigger genuinely
// fires TWICE, once per sub-step, and the two Junk are DISTINCT permanents
// (D164's allocator teeth).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CRIMSON_CARAVANEER_SCRIPT } from './crimsonCaravaneer';
import { JUNK_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARAVANEER = 'Crimson Caravaneer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; caravaneer: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARAVANEER], []],
    scripts: createRegistry([CRIMSON_CARAVANEER_SCRIPT]),
  });
  const caravaneer = put(g, 'p1', CARAVANEER);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  return { g, caravaneer };
}

describe('Crimson Caravaneer', () => {
  test('an unblocked double striker makes TWO Junk — one per damage sub-step, distinct ids', () => {
    const { g, caravaneer } = game();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: caravaneer, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(g, (s) => s.turn.step === 'endCombat' || s.turn.turnNumber > 3, 20_000);
    settle(g);
    const junks = Object.values(g.state.cards).filter(
      (c) => c.isToken && c.printingId === JUNK_TOKEN.scryfallId,
    );
    expect(junks).toHaveLength(2);
    expect(new Set(junks.map((j) => j.zone.kind))).toEqual(new Set(['battlefield']));
    // 1 power, double strike: the player took 1 in each sub-step.
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g, caravaneer } = game();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: caravaneer, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
