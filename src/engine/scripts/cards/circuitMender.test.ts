// `Circuit Mender` — 2 life on entry; a card on the way out, whether it
// dies or is bounced.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CIRCUIT_MENDER_SCRIPT } from './circuitMender';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MENDER = 'Circuit Mender';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player),
    ).length;
}

function entered(): { g: Game; mender: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [[MENDER], []],
    scripts: createRegistry([CIRCUIT_MENDER_SCRIPT]),
  });
  settle(g);
  const life0 = g.state.players['p1']?.life ?? 0;
  const mender = put(g, 'p1', MENDER);
  settle(g);
  return { g, mender, life0 };
}

describe('Circuit Mender', () => {
  test('entering is 2 life', () => {
    const { g, life0 } = entered();
    expect(g.state.players['p1']?.life).toBe(life0 + 2);
  });

  test('dying draws a card', () => {
    const { g, mender } = entered();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mender, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('a bounce draws too — "leaves", not "dies"', () => {
    const { g, mender } = entered();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mender, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[mender]?.zone.kind).toBe('hand');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, mender } = entered();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mender, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
