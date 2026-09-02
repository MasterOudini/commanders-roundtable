// `Pelakka Wurm` — 7 life on entry; a card when it dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PELAKKA_WURM_SCRIPT } from './pelakkaWurm';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WURM = 'Pelakka Wurm';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function entered(): { g: Game; wurm: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [[WURM], []],
    scripts: createRegistry([PELAKKA_WURM_SCRIPT]),
  });
  settle(g);
  const life0 = g.state.players['p1']?.life ?? 0;
  const wurm = put(g, 'p1', WURM);
  settle(g);
  return { g, wurm, life0 };
}

describe('Pelakka Wurm', () => {
  test('entering is 7 life', () => {
    const { g, life0 } = entered();
    expect(g.state.players['p1']?.life).toBe(life0 + 7);
  });

  test('dying draws a card', () => {
    const { g, wurm } = entered();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: wurm, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, wurm } = entered();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: wurm, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
